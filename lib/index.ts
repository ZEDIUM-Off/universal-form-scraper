import { Form, FormField } from "./types";
import puppeteer from "puppeteer";
import * as cheerio from 'cheerio';
import { NEXT_BUTTON_SELECTORS, SUBMIT_BUTTON_SELECTORS } from "./const";

export class FormScraper {
		private _form: Form;
		private _url: string;

    constructor(url: string) {
        this._url = url;
				this._form = {
					id: "",
					url: this._url,
					action: "",
					fields: [],
					method: ""
				};
    }

		async scrape() {
			const browser = await puppeteer.launch({ headless: false });
			const page = await browser.newPage();
			await page.goto(this._url);
			let formEnded = false;
			while (!formEnded) {
				console.log("Scraping form...");
				await page.waitForSelector("form");
				const fields = await this.getFields(page);
				this._form.fields = [...this._form.fields, ...fields];
				formEnded = await this.checkFormEnded(page);
			}
			await browser.close();
			return this._form;
		}

		async checkFormEnded(page: any): Promise<boolean> {
			await page.setRequestInterception(true);
			page.on('request', (request: any) => {
				const resourceType = request.resourceType();
				if (['image', 'stylesheet', 'font'].includes(resourceType)) {
					request.abort();
				} else {
					request.continue();
				}
			});
			const html = await page.content();
			const $ = cheerio.load(html);
			const submitButton = this.findSubmitButton($);
			if (submitButton && submitButton.length > 0) {
				console.log("Form ended");
				return true;
			}
			const nextButton: any = this.findNextButton($);
			if (nextButton.length > 0) {
				console.log("Form, found next part");
				// const nextButtonText = nextButton[0].attribs.class;
				try {
					console.log("Clicking next button: ", nextButton);
					await page.click(nextButton);
				} catch (error) {
					throw error;
				}
				await page.waitForNavigation();
				return false;
			}
			return true;
		}

		findNextButton($: any) {
			let submitButton: any;
			if (this._url.includes('google.com/forms/') || this._url.includes('forms.gle/')) {
				const selector = $('div[role="button"]');
				selector.each((index: any, element: any) => {
					const span = $(element).find('span').filter((i: any, el: any) => $(el).text().trim() === "Suivant");
					if (span.length > 0) {
						console.log("Found next button (google.com/forms/): ", $(element));
						submitButton = $(element)[0];
						return false;
					}
				});
				return submitButton;
			}
			return $(NEXT_BUTTON_SELECTORS);
		}

		findSubmitButton($: any) {
			let submitButton: any;
			if (this._url.includes('google.com/forms/') || this._url.includes('forms.gle/')) {
				const selector = $('div[role="button"]');
				selector.each((index: any, element: any) => {
					const span = $(element).find('span').filter((i: any, el: any) => $(el).text().trim() === "Envoyer");
					if (span.length > 0) {
						submitButton = $(element);
						return false;
					}
				});
				return submitButton;
			}
			return $(SUBMIT_BUTTON_SELECTORS);
		}

		async getFields(page: any): Promise<FormField[]> {
			let fields: FormField[] = [];
			const html = await page.content();
			const $ = cheerio.load(html);
			$('input, select, textarea').each((i, el) => {
				let field: FormField = {};
				const input = $(el);
				field.type = input.attr("type");
				if (field.type === "hidden" || field.type === "submit") {
					return;
				}
				field.name = input.attr("name");
				field.required = input.attr("required") === "true";
				field.value = input.val();
				field.options = input.find("option").map((i, el) => {
					return $(el).text();
				}).get();
				field.label = input.attr("label");
				field.tag = input.prop("tagName");
				fields.push(field);
			});
			return fields;
		}
}