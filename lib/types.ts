// import { BaseLanguageModel } from "langchain/base_language";

export type FormField = {
	name?: string;
	type?: string;
	balise?: string;
	required?: boolean;
	visible?: boolean;
	value?: string | string[] | number | boolean | null;
	options?: {
		dependsOn?: {
			name: string;
			value: string | string[] | number | boolean | null;
		};
		name: string;
		value: string | string[] | number | boolean | null;
	}[];
	variations?: FieldStateDescriptor[];
}

export type FormModel = {
	id: string;
	title: string;
	url: string;
	action?: string;
	method?: string;
	fields: FormField[];
}

export type FormData = {
	rawForm: string;
	variations: FieldStateDescriptor[];
	fieldList: string[];
}

export type MinimalFormField = {
	name: string;
	type: string;
	value?: string | string[] | number | boolean | null;
	options?: {
		name: string;
		value: string | string[] | number | boolean | null;
	}[];
}

export type FieldStateDescriptor = {
	name: string;
	value: string | string[] | number | boolean | null;
	changedFields: MinimalFormField[];
}

export type FieldDataMap = {
	formName: string | null;
	dataName: string | null;
	values: {
		rawValue: string | string[] | number | boolean | null;
		correspondingValue?: string;
		valueLabel?: string;
	}[];
}

export type DataMap = {
	fields: FieldDataMap[];
}

// export type LLMConfig = {
// 	type: "api" | "local";
// 	apiKey?: string;
// 	model: BaseLanguageModel;
// }