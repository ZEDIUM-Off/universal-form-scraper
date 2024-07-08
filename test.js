const { ChatOpenAI } = require("@langchain/openai");
const { Ollama } = require("@langchain/community/llms/ollama");
const { FormScraperAgent } = require("./dist/index.js");
const fs = require("fs");
const path = require("path");

require('dotenv').config();

const outputDir = path.join(__dirname, "output");

async function main() {
	const llm = new ChatOpenAI({
		model: "gpt-3.5-turbo",
		apiKey: process.env.OPENAI_API_KEY,
		temperature: 0,
	});
	const agent = new FormScraperAgent(llm);
	const formModel = await agent.generateFormModel("http://localhost:3000/form-tests/cpam-test");
	fs.writeFileSync(path.join(outputDir, `formModel-${formModel.id}.json`), JSON.stringify(formModel))
	const dataset = require("./data/dataset.json");
	const formMapping = await agent.mapFormModelToData(dataset.data[0]);
	fs.writeFileSync(path.join(outputDir, `formMapping-${formModel.id}.json`), JSON.stringify(formMapping))
	const dataMapping = await agent.dataMapping(dataset.data[0]);
	fs.writeFileSync(path.join(outputDir, `dataMapping-${formModel.id}.json`), JSON.stringify(dataMapping))
	console.log("form description saved for id :", formModel.id)
}

// Exécution de l'exemple
main();