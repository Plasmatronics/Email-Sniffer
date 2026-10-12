import * as cheerio from "cheerio";
import { emailRegex, EmailExtractionStrategy } from "../EmailExtractor";

export class HTMLEmailExtractor implements EmailExtractionStrategy {
	extractEmails(html: string): string[] {
		const $ = cheerio.load(html);
		const emailsInHtml = $.html().match(emailRegex) ?? [];

		return emailsInHtml;
	}
}
