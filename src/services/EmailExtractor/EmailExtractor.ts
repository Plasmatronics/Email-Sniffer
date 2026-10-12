export interface EmailExtractionStrategy {
	extractEmails(parsable: string): string[];
}

export interface EmailExtractionConfig {
	maxContentLength: number;
}

const DEFAULT_EMAIL_EXTRACTION_CONFIG: EmailExtractionConfig = {
	maxContentLength: 1_000_000,
};

export const emailRegex = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

export class EmailExtractor {
	constructor(
		private readonly emailExtractionStrategy: EmailExtractionStrategy,
		private readonly config: EmailExtractionConfig = DEFAULT_EMAIL_EXTRACTION_CONFIG,
	) {}

	private clampSize(parsable: string): string {
		const max = this.config.maxContentLength;
		if (parsable.length > max) {
			const delta = parsable.length - max;
			console.warn(
				`Did not process the last ${delta} of this string because it surpassed the maxContentLength of ${max}`,
			);

			return parsable.slice(0, max);
		}

		return parsable;
	}

	extractEmails(parsable: string): string[] {
		const clampedParsable = this.clampSize(parsable);
		const emails = this.emailExtractionStrategy.extractEmails(clampedParsable);
		const uniqueEmails = [...new Set(emails)];
		return uniqueEmails;
	}
}
