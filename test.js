const { ChatOpenAI } = require("@langchain/openai");
const { ChatMistralAI } = require("@langchain/mistralai")
const { OllamaFunctions } = require("@langchain/community/experimental/chat_models/ollama_functions");
const { FormScraperAgent } = require("./dist/index.js");
const fs = require("fs");
const path = require("path");
const { formatToFormModel, formatFieldMapping, formatDataMapping } = require("./dist/const.js")

require('dotenv').config();

const outputDir = path.join(__dirname, "output");

async function main() {
	const gpt3 = new ChatOpenAI({
		model: "gpt-3.5-turbo",
		apiKey: process.env.OPENAI_API_KEY,
		temperature: 0,
	})
		.bind({
			tools: [
				formatToFormModel,
				formatFieldMapping,
				formatDataMapping,
			],
			// function_call : {
			// 	name: "format_to_form_model"
			// }
		});
	const mistral_local = new OllamaFunctions({
		// baseUrl: process.env.OLLAMA_URL,
		model: 'mistral'
	})
		.bind({
			tools: [
				formatToFormModel,
				formatFieldMapping,
				formatDataMapping,
			],
		});

	const mistral_api = new ChatMistralAI({
		apiKey: process.env.MISTRAL_API_KEY,
		model: "mistral-large-latest",
		temperature: 0,
	}).bind({
		tools: [
			formatToFormModel,
			formatFieldMapping,
			formatDataMapping,
		],
	});
	const agent = new FormScraperAgent(mistral_api);

	console.time('Total execution time');
	console.time('generateFormModel');
	const formModel = await agent.generateFormModel("http://localhost:3000/form-tests/cpam-test");
	console.timeEnd('generateFormModel');
	fs.writeFileSync(path.join(outputDir, `formModel-${formModel.id}.json`), JSON.stringify(formModel))
	const dataset = require("./data/dataset.json");
	console.time('mapFormModelToData');
	const formMapping = await agent.mapFormModelToData(dataset.data[0]);
	console.timeEnd('mapFormModelToData');
	fs.writeFileSync(path.join(outputDir, `formMapping-${formModel.id}.json`), JSON.stringify(formMapping))
	console.time('dataMapping');
	const dataMapping = await agent.dataMapping(dataset.data[0]);
	console.timeEnd('dataMapping');
	fs.writeFileSync(path.join(outputDir, `dataMapping-${formModel.id}.json`), JSON.stringify(dataMapping))
	console.log("form description saved for id :", formModel.id)
	console.timeEnd('Total execution time');
	console.log('\nRésumé des temps d\'exécution:');
	console.log(`generateFormModel: ${performance.getEntriesByName('generateFormModel')[0].duration.toFixed(2)} ms`);
	console.log(`mapFormModelToData: ${performance.getEntriesByName('mapFormModelToData')[0].duration.toFixed(2)} ms`);
	console.log(`dataMapping: ${performance.getEntriesByName('dataMapping')[0].duration.toFixed(2)} ms`);
	console.log(`Total: ${performance.getEntriesByName('Total execution time')[0].duration.toFixed(2)} ms`);
}

// Exécution de l'exemple
main();