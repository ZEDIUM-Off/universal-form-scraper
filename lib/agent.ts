import { FormFetcher } from "./tools";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { FormData, FieldStateDescriptor, FormModel, DataMap, FieldDataMap } from "./types";
import { formScrapingPrompt, formSchema, formMappingPrompt, dataMappingPrompt, dataMappingSchema, formatInstructions } from "./const";
import { v4 as uuidv4 } from "uuid";
import { tool } from "@langchain/core/tools";
import { JsonOutputParser } from "@langchain/core/output_parsers";
import { JsonOutputFunctionsParser } from "@langchain/core/output_parsers/openai_functions";
import { InputValues } from "@langchain/core/utils/types";
import { createStructuredOutputChainFromZod } from "langchain/chains/openai_functions";

export class FormScraperAgent {
	private _formFetcher: FormFetcher;
	private _formData: FormData;
	private _scrapingPrompt: ChatPromptTemplate;
	private _mappingPrompt: ChatPromptTemplate;
	private _model: BaseChatModel;
	private _formModel: FormModel | null;
	private _formMapping: any;
	private _parser: JsonOutputParser<Record<string, any>>;

	constructor(model: BaseChatModel) {
		this._model = model;
		this._formFetcher = new FormFetcher();
		this._formData = { rawForm: "", variations: [], fieldList: [] };
		this._scrapingPrompt = formScrapingPrompt;
		this._mappingPrompt = formMappingPrompt;
		this._formModel = null;
		this._parser = new JsonOutputParser()
	}

	addVariations(formModel: FormModel, variations: FieldStateDescriptor[]) {
		if (!formModel || !formModel.fields) {
			throw new Error("Form model not initialized or missing fields");
		}
		variations.forEach(variation => {
			const fieldName = variation.name;
			const fieldValue = variation.value;
			variation.changedFields.forEach(changedField => {
				const field = formModel.fields.find(f => f.name === changedField.name);
				if (field?.options && changedField.options) {
					changedField.options.forEach(option => {
						if (!field.options?.find(o => o.value === option.value)) {
							const opt = {
								...option,
								dependsOn: {
									name: fieldName,
									value: fieldValue
								}
							}
							field.options?.push(opt);
						}
					});
				}
			});
		});
	
		return formModel;
	}

	
	async generateFormModel(url: string) {
		const formData = await this.fetchFormData(url);
		console.log("extracting model...");
		const prompt = this._scrapingPrompt;
		const chain = prompt.pipe(this._model).pipe(this._parser);
		const result = await chain.invoke({rawForm: JSON.stringify(formData.rawForm), fieldList: JSON.stringify(formData.fieldList)});
		console.log(result);
		const model = {
			id: uuidv4(),
			url: url,
			...result
		} as FormModel;
		this._formModel = this.addVariations(model, formData.variations);
		console.log("model extracted!");
		return this._formModel;
	}

	async mapFormModelToData(dataset: any) {
		if (!this._formModel || !this._formModel.fields) {
			throw new Error("Form model not initialized or missing fields");
		}
		const lightModel = Object.fromEntries(
			this._formModel.fields
				.filter((field: any) => field.name)
				.map((field: any) => [field.name!, ""])
		);
		console.log(lightModel);
		const executable = this._mappingPrompt.pipe(this._model).pipe(this._parser);
		console.log("mapping form model to data...");
		const result = await executable.invoke({rawForm: JSON.stringify(this._formData.rawForm), dataset: JSON.stringify(dataset), formModelFields: JSON.stringify(lightModel)});
		console.log("form model mapped!");
		console.log(result);
		this._formMapping = result;
		return this._formMapping;
	}

	async dataMapping(dataset: any) {
		if (!this._formModel || !this._formModel.fields) {
			throw new Error("Form model not initialized or missing fields");
		}
	
		const predeterminedFields: FieldDataMap[] = [];
	
		this._formModel.fields.forEach(field => {
			const fieldDataMap: FieldDataMap = {
				formName: field.name ?? null,
				dataName: this._formMapping.mappedFields.find((mapping: any) => mapping.model_field_name === field.name)?.data_field_name ?? null,
				values: []
			};
	
			if (field.balise === 'select' && field.options && field.options.length > 0) {
				// Pour les champs select, on ajoute toutes les options
				field.options.forEach(option => {
					if (option.value !== null && option.value !== undefined) {
						fieldDataMap.values.push({
							rawValue: option.value,
							valueLabel: option.name
						});
					}
				});
			}
			else if (field.type === 'radio' && field.options) {
				field.options.forEach(option => {
					if (option.value !== null && option.value !== undefined) {
						fieldDataMap.values.push({
							rawValue: option.value,
							valueLabel: option.name
						});
					}
				});
			}
			else if (field.type === 'checkbox') {
				fieldDataMap.values.push(
					{ rawValue: true},
					{ rawValue: false}
				);
			}

			// On n'ajoute le champ que s'il a des valeurs prédéterminées
			if (fieldDataMap.values.length > 0) {
				predeterminedFields.push(fieldDataMap);
			}
		});
		console.log("Predetermined fields:", JSON.stringify(predeterminedFields, null, 2));
		console.log("mapping data to predetermined fields...");
		const filterDataSet = await this.filterDataSet(dataset, predeterminedFields);
		console.log("Filtered dataset:", JSON.stringify(filterDataSet, null, 2));
		const executable = dataMappingPrompt.pipe(this._model).pipe(this._parser);
		const result = await executable.invoke({dataset: JSON.stringify(filterDataSet), predeterminedFields: JSON.stringify(predeterminedFields)});
		console.log("data mapped!");
		console.log(result);
		return result;
	}

	async filterDataSet(dataset: any, predeterminedFields: FieldDataMap[]) {
		const filteredDataSet: any = {};
	
		// Créer un ensemble des noms de champs prédéterminés pour une recherche plus rapide
		const predeterminedFieldNames = new Set(predeterminedFields.map((field: any) => field.dataName));
	
		// Parcourir chaque entrée du dataset
		Object.entries(dataset).forEach(([key, value]) => {
			// Si le champ est dans predeterminedFields, l'ajouter au filteredDataSet
			if (predeterminedFieldNames.has(key)) {
				filteredDataSet[key] = value;
			}
		});
	
		return filteredDataSet;
	}

	async fetchFormData(url: string) {
		this._formData = await this._formFetcher.getFormData(url);
		console.log("form data fetched!");
		return this._formData;
	}
}