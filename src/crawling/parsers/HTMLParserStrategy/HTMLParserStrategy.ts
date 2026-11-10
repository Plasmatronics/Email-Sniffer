import * as cheerio from "cheerio";
import { Text } from "domhandler";
import { ParsedResults, ParserStrategy } from "../parserStrategy.types";
import { logger } from "../../../infrastructure";

export class HTMLParserStrategy implements ParserStrategy {
	private readonly serviceName = "HTMLParserStrategy";

	supports(contentType: string): boolean {
		return contentType.split(";")[0].trim().toLowerCase() === "text/html";
	}

	async parse(content: Buffer): Promise<ParsedResults> {
		const startTime = Date.now();
		const childLogger = logger.child({ serviceName: this.serviceName });
		const $ = cheerio.loadBuffer(content);

		$("script, style, noscript, template, svg").remove();

		$("a[href]").each((_, element) => {
			const href = $(element).attr("href");
			if (!href?.toLowerCase().startsWith("mailto:")) return;

			try {
				const recipients = decodeURIComponent(new URL(href).pathname);
				$(element).append(new Text(` ${recipients}`));
			} catch (err: unknown) {
				childLogger.warn(
					{ err, href, durationMs: Date.now() - startTime },
					"Encountered malformed mailto link",
				);
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

		const result = {
			text,
			links,
		};
		childLogger.debug(
			{ links: links.length, durationMs: Date.now() - startTime },
			"HTML parsing completed",
		);
		return result;
	}
}
