import z from "zod";
import { EmailPattern, generateEmailLocalPartMap } from "../../shared";
import { ExtractedEmail } from "../EmailExtractor";
import { TextChunker } from "../TextChunker";

export interface PatternInference {
	email: string;
	pattern: EmailPattern;
}

export class EmailPatternInferrer {
	constructor(private chunker: TextChunker) {}

	inferEmailPatterns(
		extractedEmails: ExtractedEmail[],
		document: string,
	): PatternInference[] {
		const chunkedDocument = this.chunker.chunk(document);
		const inferredEmailsAndPatterns: PatternInference[] = [];

		for (const emailExtraction of extractedEmails) {
			const inferrence = this.findPattern(emailExtraction, chunkedDocument);
			if (!inferrence) continue;
			inferredEmailsAndPatterns.push(inferrence);
		}

		return inferredEmailsAndPatterns;
	}

	private findPattern(
		emailExtraction: ExtractedEmail,
		chunkedDocument: string[],
	): PatternInference | undefined {
		const email = emailExtraction.email;
		const emailLocalPart = this.getLocalEmailPart(email);
		if (!emailLocalPart) return undefined;

		const n = chunkedDocument.length;

		let backwardL = Math.max(0, emailExtraction.wordIndex - 3);
		let backwardR = emailExtraction.wordIndex - 1;

		let forwardL = emailExtraction.wordIndex + 1;
		let forwardR = Math.min(emailExtraction.wordIndex + 3, n - 1);

		while (backwardL >= 0 || forwardR < n) {
			if (backwardL >= 0) {
				for (const [firstName, lastName] of this.getNameCandidates(
					chunkedDocument.slice(backwardL, backwardR + 1),
				)) {
					const pattern = this.retrieveCorrectPattern(
						firstName,
						lastName,
						emailLocalPart,
					);
					if (pattern) return { pattern, email };
				}

				backwardL--;
				backwardR--;
			}

			if (forwardR < n) {
				for (const [firstName, lastName] of this.getNameCandidates(
					chunkedDocument.slice(forwardL, forwardR + 1),
				)) {
					const pattern = this.retrieveCorrectPattern(
						firstName,
						lastName,
						emailLocalPart,
					);
					if (pattern) return { pattern, email };
				}

				forwardL++;
				forwardR++;
			}
		}

		return undefined;
	}

	private getNameCandidates(words: string[]): [string, string][] {
		const cleanedWords = words
			.map((word) =>
				word
					.normalize("NFD")
					.replace(/[\u0300-\u036f]/g, "")
					.toLowerCase()
					.replace(/[^a-z]/g, ""),
			)
			.filter(Boolean);

		const NUM_WORDS_IN_NAME = 2;
		const seen = new Set<number>();

		const allPermutations: Array<[string, string]> = [];
		const curPermutation: string[] = [];

		const dfs = (): void => {
			if (curPermutation.length === NUM_WORDS_IN_NAME) {
				allPermutations.push([...curPermutation] as [string, string]);
				return;
			}

			for (let i = 0; i < cleanedWords.length; i++) {
				if (seen.has(i)) continue;
				curPermutation.push(cleanedWords[i]);
				seen.add(i);

				dfs();

				curPermutation.pop();
				seen.delete(i);
			}

			return;
		};
		dfs();

		return allPermutations;
	}

	/*
	Can chunk email generation map these into categories, to prune impossible paths
	(i.e an email with a dot will never match one without)
	But will only examine this in case of need for further optimization
	*/
	private retrieveCorrectPattern(
		firstName: string,
		lastName: string,
		localEmailPart: string,
	): EmailPattern | undefined {
		for (const [pattern, emailGenerator] of Object.entries(
			generateEmailLocalPartMap,
		)) {
			const generatedEmail = emailGenerator(firstName, lastName);
			if (generatedEmail.toLowerCase() === localEmailPart.toLowerCase())
				return pattern as EmailPattern;
		}

		return undefined;
	}

	private getLocalEmailPart(email: string): string {
		const safeEmail = z.email().safeParse(email);
		if (!safeEmail.success) return "";

		return safeEmail.data.split("@")[0];
	}
}
