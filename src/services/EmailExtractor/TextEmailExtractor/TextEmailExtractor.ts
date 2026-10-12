import { emailRegex } from "../EmailExtractor";
import { EmailExtractionStrategy } from "../EmailExtractor";

export class TextEmailExtractor implements EmailExtractionStrategy {
	extractEmails(text: string): string[] {
		const emailMatches = text.match(emailRegex) ?? [];
		return emailMatches;
	}
}
