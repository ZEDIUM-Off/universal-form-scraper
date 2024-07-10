import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { FormModel } from "./types";

export const optionSchema = z.object({
  name: z.string().describe("Le nom de l'option"),
  value: z.union([z.string(), z.number(), z.boolean(), z.null()]).nullable().describe("La valeur de l'option"),
});

export const changedFieldSchema = z.object({
  name: z.string().describe("Le nom du champ"),
	type: z.string().describe("Le type du champ (texte, nombre, email..)"),
	value: z.union([z.string(), z.number(), z.boolean(), z.null()]).nullable().describe("La valeur du champ"),
	options: z.array(optionSchema).optional().describe("Les options pour les champs de type select ou radio"),
});

export const formFieldVariationSchema = z.object({
  name: z.string().describe("Le nom du champ"),
  value: z.union([z.string(), z.number(), z.boolean(), z.null()]).nullable().describe("La valeur du champ"),
	changedFields: z.array(changedFieldSchema).describe("Les champs modifiés dans la variation"),
});

export const formFieldSchema = z.object({
  name: z.string().describe("Le nom du champ"),
  balise: z.string().describe("La balise du champ (input, select, textarea, etc.)"),
  type: z.string().describe("Le type du champ (button, submit, email, etc.)"),
  required: z.boolean().describe("Si le champ est obligatoire ou non"),
  visible: z.boolean().optional().describe("Si le champ est visible ou non"),
	value: z.union([z.string(), z.number(), z.boolean(), z.null()]).nullable().optional().describe("La valeur actuelle du champ, si disponible"),
  options: z.array(optionSchema).optional().describe("Les options pour les champs de type select ou radio"),
  variations: z.array(formFieldVariationSchema).optional().describe("Les variations du champ"),
});

export const formSchema = z.object({
  title: z.string().describe("Le titre du formulaire"),
  multiStep: z.boolean().describe("Si le formulaire est en plusieurs étapes"),
  currentStep: z.number().optional().describe("L'étape actuelle pour les formulaires multi-étapes"),
	method: z.string().optional().describe("La méthode du formulaire"),
	action: z.string().optional().describe("L'URL de l'action du formulaire"),
	fields: z.array(formFieldSchema).describe("Les champs du formulaire"),
});

export const formMappingSchema = z.object({
  mappedFields: z.array(
    z.object({
      model_field_name: z.string().describe("field name in fieldList"),
      data_field_name: z.string().describe("field name in dataset")
    })
  ).describe("mapped fields list")
});

export const mapValueSchema = z.object({
  rawValue: z.union([z.string(), z.number(), z.boolean(), z.null()]).optional().describe("La valeur originale du champ(ne pas changer)"),
  valueLabel: z.string().optional().describe("La label original de la valeur"),
  correspondingValue: z.string().describe("La valeur correspondante du champ dans le dataset a trouver"),
});

export const fieldDataMapSchema = z.object({
  name: z.string().describe("Le nom du champ"),
  values: z.array(mapValueSchema).describe("Les valeurs a mapper"),
});

export const dataMappingSchema = z.object({
  mappedFields: z.array(fieldDataMapSchema).describe("Les champs mappés du dataset"),
});

export const formatInstructions = (schema: any) => `Respond only in valid JSON. Do not use ellipses (...) to omit any information. The JSON object you return should match the following schema:\n${JSON.stringify(zodToJsonSchema(schema))}`

export const formScrapingPrompt = ChatPromptTemplate.fromMessages([
	[
    "system", "You are an expert extraction algorithm.\
		With the given HTML code, create a comprehensive model that describes the form.\
		rawForm: the HTML code of the form\
		fieldList: the list of fields to extract from the form\
    For each field in the form, return the following details:\
		- name: The name of the field\
		- balise: The HTML tag of the field (e.g., input, select, textarea, etc.)\
		- type: The type of the field (e.g., text, number, email, etc.)\
		- required: Whether the field is required (true/false)\
		- visible: Whether the field is visible (true/false)\
		- value: The current value of the field, if available\
		- options: For fields like select or radio, provide all available options\
		Ensure that all fields and their informations are included in the output. DO NOT use ellipses (...) to omit any information. If a value is not available, use null or an empty string.\n\
    Respond only in valid JSON. CALL TOOL !",
    // {format_instructions}
  ],
	["human", "rawForm: {rawForm}\nfieldList: {fieldList}"]
])
// .partial({
//   format_instructions: formatInstructions(formSchema),
// });

export const formMappingPrompt = ChatPromptTemplate.fromMessages([
  [
    "system","You are an expert mapping algorithm.\n\
    (field mapping)\
    With the given dataset and form model, map form model fields to dataset fields.\n\
    rawForm: the HTML code of the form\n\
    dataset: the dataset to be mapped\n\
    formModelFields: the form model fields\n\
    Return a JSON object that contains the mapping.\n\
		you must return a JSON object with the following format: \"ModelFieldName\": \"DatasetFieldName\"\n\
    For each field in the model, find the corresponding field in the dataset and map it to the model field.\n\
    Fields can have differents names in the dataset, you must find the correct field in the dataset and map it to the model field.\n\
    You can use the rawForm as a context to find the correct field in the dataset.\n\
    If a field doesn't have a direct correspondence in the dataset, find the closest field in the dataset that has the same type and name else use null."
  ],
  ["human", "rawForm: {rawForm}\ndataset: {dataset}\nformModelFields: {formModelFields}"]
]);

export const dataMappingPrompt = ChatPromptTemplate.fromMessages([
  [
    "system",
    `Vous êtes un expert en mapping de données. Votre tâche est de faire correspondre les valeurs d'un dataset avec des champs prédéterminés.
    (data mapping)
Instructions :
1. Utilisez le 'dataset' fourni et les 'predeterminedFields' pour trouver les correspondances.
2. Dans 'predeterminedFields', chaque champ a un 'formName' (nom dans le formulaire) et un 'dataName' (nom dans le dataset).
3. Chaque champ a des 'values' possibles, chacune avec 'rawValue' et 'valueLabel'.
4. Le but est de trouver une valeur dans valueLabel qui corresponds a une valeur dans le dataset, si une valeur corresponds, remplir correspondingValue.
5. Votre tâche est de trouver la valeur correspondante dans le dataset pour chaque champ prédéterminé.
6. Retournez un objet JSON avec la structure donné.
6. Incluez uniquement les champs pour lesquels vous avez trouvé une correspondance.
7. Si plusieurs valeurs correspondent, mapper chaque correspondance.

Exemple :
Si dans le dataset : "ville": "J'habite à Paris"
Et dans predeterminedFields :
  "formName": "city",
  "dataName": "ville",
  "values": [
    (
      "rawValue": 01,
      "valueLabel": "Paris"
    ),
    (
      "rawValue": 2,
      "valueLabel": "Lille"
    )
  ]

Votre réponse devrait être :
  "name": "city",
  "values": [
      "rawValue": 01,
      "valueLabel": "Paris",
      "correspondingValue": "J'habite à Paris"
  ]

Assurez-vous de faire correspondre les valeurs aussi précisément que possible, en tenant compte des variations mineures dans l'orthographe ou la formulation.`
  ],
  ["human", "dataset: {dataset}\npredeterminedFields: {predeterminedFields}"]
]);


export const formatToFormModel = {
  type: "function",
  function : {
  name: "format_to_form_model",
  description: "Should always be used to properly format output if its a form model descrition",
  parameters:  zodToJsonSchema(formSchema),
  }
}

export const formatFieldMapping = {
  type: "function",
  function : {
  name: "format_field_mapping",
  description: "Should always be used to properly format output if its a field mapping",
  parameters: zodToJsonSchema(formMappingSchema),
  }
}

export const formatDataMapping = {
  type: "function",
  function : {
    name: "format_data_mapping",
    description: "Should always be used to properly format output if its a data mapping",
    parameters: zodToJsonSchema(dataMappingSchema),
  }
}