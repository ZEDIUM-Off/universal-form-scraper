require("dotenv").config();

const { FormScraper } = require("./dist/index.js");

const scraper = new FormScraper("https://forms.gle/ayJXXCtKCTmiovtC8");
scraper.scrape().then((form) => {
	console.log(form);
});
