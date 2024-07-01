export type FormField = {
	name?: string;
	type?: string;
	tag?: string;
	label?: string;
	required?: boolean;
	value?: string | string[] | number | boolean | null;
	options?: string[];
}

export type Form = {
	id: string;
	url: string;
	action: string;
	method: string;
	fields: FormField[];
}