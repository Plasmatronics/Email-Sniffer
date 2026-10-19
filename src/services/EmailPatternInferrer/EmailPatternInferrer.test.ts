import { describe, expect, test } from "vitest";
import { EmailPattern } from "../../shared";
import type { ExtractedEmail } from "../EmailExtractor";
import { TextChunker } from "../TextChunker";
import { EmailPatternInferrer } from "./EmailPatternInferrer";

const PATTERN_CASES = [
	{
		label: "first name dot last name",
		localPart: "alice.brown",
		pattern: EmailPattern.FirstNameDotLastName,
	},
	{
		label: "first name followed by last name",
		localPart: "alicebrown",
		pattern: EmailPattern.FirstNameLastName,
	},
	{
		label: "first initial followed by last name",
		localPart: "abrown",
		pattern: EmailPattern.FirstInitialLastName,
	},
	{
		label: "first initial dot last name",
		localPart: "a.brown",
		pattern: EmailPattern.FirstInitialDotLastName,
	},
	{
		label: "first name followed by last initial",
		localPart: "aliceb",
		pattern: EmailPattern.FirstNameLastInitial,
	},
	{
		label: "first name dot last initial",
		localPart: "alice.b",
		pattern: EmailPattern.FirstNameDotLastInitial,
	},
	{
		label: "first name underscore last name",
		localPart: "alice_brown",
		pattern: EmailPattern.FirstNameUnderscoreLastName,
	},
	{
		label: "first name hyphen last name",
		localPart: "alice-brown",
		pattern: EmailPattern.FirstNameHyphenLastName,
	},
	{
		label: "last name dot first name",
		localPart: "brown.alice",
		pattern: EmailPattern.LastNameDotFirstName,
	},
	{
		label: "last name followed by first name",
		localPart: "brownalice",
		pattern: EmailPattern.LastNameFirstName,
	},
	{
		label: "last name followed by first initial",
		localPart: "browna",
		pattern: EmailPattern.LastNameFirstInitial,
	},
	{
		label: "first name only",
		localPart: "alice",
		pattern: EmailPattern.FirstName,
	},
	{
		label: "last name only",
		localPart: "brown",
		pattern: EmailPattern.LastName,
	},
	{
		label: "first and last initials",
		localPart: "ab",
		pattern: EmailPattern.FirstInitialLastInitial,
	},
] as const;

describe("EmailPatternInferrer", () => {
	function createInferrer(): EmailPatternInferrer {
		return new EmailPatternInferrer(new TextChunker());
	}

	function createExtraction(email: string, wordIndex: number): ExtractedEmail {
		return { email, wordIndex };
	}

	test.each(PATTERN_CASES)(
		"infers the $label pattern from a preceding name",
		({ localPart, pattern }) => {
			const inferrer = createInferrer();
			const email = `${localPart}@example.com`;

			const inferences = inferrer.inferEmailPatterns(
				[createExtraction(email, 2)],
				`Alice Brown ${email}`,
			);

			expect(inferences).toEqual([{ email, pattern }]);
		},
	);

	test("infers a pattern from a following name", () => {
		const inferrer = createInferrer();
		const email = "alice.brown@example.com";

		const inferences = inferrer.inferEmailPatterns(
			[createExtraction(email, 0)],
			`${email} Alice Brown`,
		);

		expect(inferences).toEqual([
			{ email, pattern: EmailPattern.FirstNameDotLastName },
		]);
	});

	test("matches email local parts case-insensitively", () => {
		const inferrer = createInferrer();
		const email = "ALICE.BROWN@example.com";

		const inferences = inferrer.inferEmailPatterns(
			[createExtraction(email, 2)],
			`Alice Brown ${email}`,
		);

		expect(inferences).toEqual([
			{ email, pattern: EmailPattern.FirstNameDotLastName },
		]);
	});

	test("normalizes diacritics in nearby names", () => {
		const inferrer = createInferrer();
		const email = "jose.nunez@example.com";

		const inferences = inferrer.inferEmailPatterns(
			[createExtraction(email, 2)],
			`José Núñez ${email}`,
		);

		expect(inferences).toEqual([
			{ email, pattern: EmailPattern.FirstNameDotLastName },
		]);
	});

	test("removes punctuation from nearby names", () => {
		const inferrer = createInferrer();
		const email = "maryjane.oneil@example.com";

		const inferences = inferrer.inferEmailPatterns(
			[createExtraction(email, 2)],
			`Mary-Jane O'Neil ${email}`,
		);

		expect(inferences).toEqual([
			{ email, pattern: EmailPattern.FirstNameDotLastName },
		]);
	});

	test("returns inferences in extracted-email order", () => {
		const inferrer = createInferrer();
		const firstEmail = "alice.brown@example.com";
		const secondEmail = "carol_davis@example.com";

		const inferences = inferrer.inferEmailPatterns(
			[createExtraction(firstEmail, 2), createExtraction(secondEmail, 5)],
			`Alice Brown ${firstEmail} Carol Davis ${secondEmail}`,
		);

		expect(inferences).toEqual([
			{ email: firstEmail, pattern: EmailPattern.FirstNameDotLastName },
			{ email: secondEmail, pattern: EmailPattern.FirstNameUnderscoreLastName },
		]);
	});

	test("ignores an invalid extracted email", () => {
		const inferrer = createInferrer();

		const inferences = inferrer.inferEmailPatterns(
			[createExtraction("not-an-email", 2)],
			"Alice Brown not-an-email",
		);

		expect(inferences).toEqual([]);
	});

	test("returns no inference when the local part does not match nearby names", () => {
		const inferrer = createInferrer();
		const email = "support@example.com";

		const inferences = inferrer.inferEmailPatterns(
			[createExtraction(email, 2)],
			`Alice Brown ${email}`,
		);

		expect(inferences).toEqual([]);
	});

	test("returns no inferences when no emails were extracted", () => {
		const inferrer = createInferrer();

		const inferences = inferrer.inferEmailPatterns([], "Alice Brown");

		expect(inferences).toEqual([]);
	});

	test("inferrences on longer text snippets operate as expected", () => {
		const snippet = `Our enterprise sales team can help with pricing and onboarding. 
		For larger accounts, contact Priya Shah directly at pshah@acme.com. 
		She leads strategic partnerships for the East Coast region.`;
		const inferrer = createInferrer();
		const email = "pshah@acme.com";

		const inferences = inferrer.inferEmailPatterns(
			[createExtraction(email, 18)],
			snippet,
		);

		expect(inferences).toEqual([
			{ email, pattern: EmailPattern.FirstInitialLastName },
		]);
	});
});
