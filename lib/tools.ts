import { Tool } from "langchain/tools";
import puppeteer from "puppeteer";
import { Page } from "puppeteer";
import { FieldStateDescriptor, MinimalFormField } from "./types";
import cheerio from "cheerio";

export class FormFetcher {
  private _originalPage: string;
	private _form: any;
  private _variations: FieldStateDescriptor[];
  private _fieldList: any;

  constructor() {
    this._originalPage = '';
    this._form = null;
    this._variations = [];
    this._fieldList;
  }

  private async _loadForm(url: string) {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      if (['stylesheet', 'font', 'image'].includes(request.resourceType())) {
        request.abort();
      } else {
        request.continue();
      }
    });
		console.log("Loading form from", url);
    await page.goto(url);
    await page.waitForNetworkIdle();	
    this._originalPage = await page.content();
    const $ = cheerio.load(this._originalPage);
    this._form = $('form');
    this._fieldList = this._form.find('input, select, textarea').map((_: any, el: any) => {
      const name = $(el).attr('name');
      return name ? name : null;
    }).get().filter(Boolean);
    console.log(this._fieldList);
    await this._captureFieldStates(page);
		console.log("Form loaded");
    await browser.close();
  }

  private async _captureFieldStates(page: Page) {
    const fields = this._form.find('select, input[type="checkbox"], input[type="radio"]');

    for (let i = 0; i < fields.length; i++) {
      const field = fields.eq(i);
      const fieldName = field.attr('name');
      const fieldType = field.attr('type') || field.prop('tagName').toLowerCase();

      if (fieldType === 'select') {
        const options = field.find('option');
        for (let j = 0; j < options.length; j++) {
          const optionValue = options.eq(j).attr('value');
          await this._changeFieldAndCompare(page, field, i, optionValue);
        }
      } else if (fieldType === 'checkbox' || fieldType === 'radio') {
				const val = field.prop('checked') ? true : false;
        await this._changeFieldAndCompare(page, field, i, !val);
      }
    }
  }

  private async _changeFieldAndCompare(page: Page, field: any, fieldIndex: number, value: boolean | string | number) {
    await page.evaluate((index, val) => {
      const field = document.querySelectorAll('select, input[type="checkbox"], input[type="radio"]')[index] as HTMLInputElement | HTMLSelectElement;
      if (field) {
        if (field instanceof HTMLInputElement) {
          if (field.type === 'checkbox' || field.type === 'radio') {
            field.checked = val as boolean;
          } else {
            field.value = val as string;
          }
        } else if (field instanceof HTMLSelectElement) {
          field.value = val as string;
        }
        field.dispatchEvent(new Event('change', { bubbles: true }));
        field.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }, fieldIndex, value);

    await page.waitForNetworkIdle();
    const newContent = await page.content();
    const newPage = cheerio.load(newContent);
    const newForm = newPage('form');
    const changedFields = this._detectChanges(this._form, newForm, fieldIndex);
    if (changedFields.length > 0) {
      this._variations.push({ name: field.attr('name')!, value, changedFields });
    }
  }

  private _detectChanges(originalForm: any, newForm: any, from: number): MinimalFormField[] {
    const changedFields: MinimalFormField[] = [];
		const originalFields = originalForm.find('select, input[type="checkbox"], input[type="radio"]');
		const newFields = newForm.find('select, input[type="checkbox"], input[type="radio"]');
		for (let i = from; i < originalFields.length; i++) {
			const originalField = originalFields.eq(i);
			const newField = newFields.eq(i);
			const $ = cheerio.load(newField.html());
			if (originalField.html() !== newField.html()) {
				changedFields.push({
					name: originalField.attr('name') || '',
					type: originalField.prop('tagName').toLowerCase(),
					value: (() => {
            const rawValue = newField.prop('value');
            const numValue = Number(rawValue);
						return !isNaN(numValue) ? numValue : rawValue;
					})(),
					options: newField.find('option').map((_: any, el: any) => ({
						name: $(el).text(),
						value: (() => {
              const rawValue = $(el).attr('value') || '';
              const numValue = Number(rawValue);
              return !isNaN(numValue) ? numValue : rawValue;
            })(),
					})).get()
				});
			}
		}

    return changedFields;
  }

  async getFormData(url: string) {
    await this._loadForm(url);
    return {
      rawForm: this._originalPage,
      variations: this._variations,
      fieldList: this._fieldList
    };
  }
}
