import * as cheerio from "cheerio";
import { Text } from "domhandler";
import { ParsedResults, ParserStrategy } from "../parserStrategy.types";

export class HTMLParserStrategy implements ParserStrategy {
	supports(contentType: string): boolean {
		return contentType.split(";")[0].trim().toLowerCase() === "text/html";
	}

	async parse(content: Buffer): Promise<ParsedResults> {
		const $ = cheerio.loadBuffer(content);

		$("script, style, noscript, template, svg").remove();

		$("a[href]").each((_, element) => {
			const href = $(element).attr("href");
			if (!href?.toLowerCase().startsWith("mailto:")) return;

			try {
				const recipients = decodeURIComponent(new URL(href).pathname);
				$(element).append(new Text(` ${recipients}`));
			} catch {
				// Leave malformed mailto links unchanged.
			}
		});

		$("body *").each((_, element) => {
			$(element).before("\n");
			$(element).after("\n");
		});
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
