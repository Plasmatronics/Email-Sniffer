import { DocumentClamper } from "../DocumentClamper";
import { TextChunker } from "../TextChunker";

export interface EmailExtractionStrategy {
	extractEmails(parsable: string): string[];
}

export interface EmailExtractionConfig {
	maxContentLength: number;
}

export interface ExtractedEmail {
	email: string;
	wordIndex: number;
}

const EMAIL_REGEX = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

export class EmailExtractor {
	constructor(
		private textChunker: TextChunker,
		private documentClamper: DocumentClamper,
	) {}

	extractEmails(text: string): string[] {
		const clampedText = this.documentClamper.clamp(text.trim().toLowerCase());
		const emailMatches = clampedText.match(EMAIL_REGEX) ?? [];

		const uniqueEmails = [...new Set(emailMatches)];
		return uniqueEmails;
	}

	extractEmailMatches(text: string): ExtractedEmail[] {
		const clampedText = this.documentClamper.clamp(text.trim().toLowerCase());
		const words = this.textChunker.chunk(clampedText);

		const results: ExtractedEmail[] = [];
		const seenEmails = new Set<string>();
		let wordIndex = 0;

		for (const word of words) {
			for (const emailMatch of word.matchAll(EMAIL_REGEX)) {
				const email = emailMatch[0];

				if (!seenEmails.has(email)) {
					seenEmails.add(email);
					results.push({ email, wordIndex });
				}
			}

			wordIndex++;
		}

		return results;
	}
}
