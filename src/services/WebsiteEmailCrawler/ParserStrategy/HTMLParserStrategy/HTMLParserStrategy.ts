import * as cheerio from "cheerio";
import { ParsedResults, ParserStrategy } from "../parserStrategy.types";

export class HTMLParserStrategy implements ParserStrategy {
	constructor() {}

	supports(contentType: string): boolean {
		return contentType.split(";")[0].trim().toLowerCase() === "text/html";
	}

	async parse(content: Buffer): Promise<ParsedResults> {
		const $ = cheerio.loadBuffer(content);

		$("script, style, noscript, template, svg").remove();

		const text = $("body").text();
		const links = $("a[href]")
			.map((_, el) => $(el).attr("href"))
			.get();

		return {
			text,
			links,
		};
	}
}
