import { PDFParse } from "pdf-parse";
import { ParsedResults, ParserStrategy } from "../parserStrategy.types";

export class PDFParserStrategy implements ParserStrategy {
	supports(contentType: string): boolean {
		return contentType.split(";")[0].trim().toLowerCase() === "application/pdf";
	}

	async parse(content: Buffer): Promise<ParsedResults> {
		const parser = new PDFParse({ data: content });

		try {
			const { text } = await parser.getText();
			const { pages } = await parser.getInfo({ parsePageInfo: true });
			const links = pages.flatMap((page) => page.links.map((link) => link.url));

			return { text, links };
		} finally {
			await parser.destroy();
		}
	}
}
