import { describe, expect, test } from "vitest";
import { DocumentClamper } from "../DocumentClamper";
import { TextChunker } from "../TextChunker";
import { EmailExtractor } from "./EmailExtractor";
import { mockHTML } from "./mockHTML";

describe("EmailExtractor", () => {
	function createExtractor(): EmailExtractor {
		return new EmailExtractor(new TextChunker(), new DocumentClamper());
	}

	describe("extractEmails", () => {
		test("extracts an email from text", () => {
			const extractor = createExtractor();
			const text = "Contact jane@example.com for help.";

			const emails = extractor.extractEmails(text);

			expect(emails).toEqual(["jane@example.com"]);
		});

		test("extracts multiple emails in discovery order", () => {
			const extractor = createExtractor();
			const text = "Email first@example.com or second@example.org.";

			const emails = extractor.extractEmails(text);

			expect(emails).toEqual(["first@example.com", "second@example.org"]);
		});

		test("removes duplicate emails while preserving discovery order", () => {
			const extractor = createExtractor();
			const text = "first@example.com second@example.org first@example.com";

			const emails = extractor.extractEmails(text);

			expect(emails).toEqual(["first@example.com", "second@example.org"]);
		});

		test.each([
			["uppercase characters", "JANE.DOE@EXAMPLE.COM"],
			["a plus tag", "jane+sales@example.com"],
			["allowed local-part punctuation", "jane_doe%team@example.com"],
			["a subdomain", "jane@mail.example.co.uk"],
			["digits", "user123@example123.com"],
		])("extracts an address containing %s", (_, email) => {
			const extractor = createExtractor();

			const emails = extractor.extractEmails(`Contact ${email}.`);

			expect(emails).toEqual([email]);
		});

		test.each([
			["an empty string", ""],
			["whitespace", " \t\n "],
			["plain text", "There is no contact address here."],
			["a missing domain", "Contact jane@."],
			["a missing local part", "Contact @example.com."],
			["a one-character top-level domain", "Contact jane@example.c."],
		])("returns no results for %s", (_, text) => {
			const extractor = createExtractor();

			const emails = extractor.extractEmails(text);

			expect(emails).toEqual([]);
		});

		test("excludes surrounding punctuation from the result", () => {
			const extractor = createExtractor();
			const text = "Reach us at <jane@example.com>.";

			const emails = extractor.extractEmails(text);

			expect(emails).toEqual(["jane@example.com"]);
		});

		test("extracts emails separated by line breaks", () => {
			const extractor = createExtractor();
			const text = "first@example.com\nsecond@example.org";

			const emails = extractor.extractEmails(text);

			expect(emails).toEqual(["first@example.com", "second@example.org"]);
		});

		test("extracts an email from visible HTML text", () => {
			const extractor = createExtractor();
			const html = "<p>Contact jane@example.com for help.</p>";

			const emails = extractor.extractEmails(html);

			expect(emails).toEqual(["jane@example.com"]);
		});

		test("extracts an email from a mailto link without query parameters", () => {
			const extractor = createExtractor();
			const html =
				'<a href="mailto:jane@example.com?subject=Hello&amp;body=Welcome">Email Jane</a>';

			const emails = extractor.extractEmails(html);

			expect(emails).toEqual(["jane@example.com"]);
		});

		test("extracts multiple recipients from a mailto link", () => {
			const extractor = createExtractor();
			const html =
				'<a href="mailto:first@example.com,second@example.org">Email the team</a>';

			const emails = extractor.extractEmails(html);

			expect(emails).toEqual(["first@example.com", "second@example.org"]);
		});

		test("extracts unique emails from realistic HTML", () => {
			const extractor = createExtractor();

			const emails = extractor.extractEmails(mockHTML);

			expect(emails).toEqual(["hello@linear.app"]);
		});

		test("produces the same result across repeated calls", () => {
			const extractor = createExtractor();
			const text = "jane@example.com";

			extractor.extractEmails(text);
			const emails = extractor.extractEmails(text);

			expect(emails).toEqual(["jane@example.com"]);
		});
	});

	describe("extractEmailMatches", () => {
		test("returns an email with its word index", () => {
			const extractor = createExtractor();

			const matches = extractor.extractEmailMatches(
				"Contact jane@example.com for help",
			);

			expect(matches).toEqual([{ email: "jane@example.com", wordIndex: 1 }]);
		});

		test("returns multiple emails with their word indexes", () => {
			const extractor = createExtractor();

			const matches = extractor.extractEmailMatches(
				"Email first@example.com or second@example.org",
			);

			expect(matches).toEqual([
				{ email: "first@example.com", wordIndex: 1 },
				{ email: "second@example.org", wordIndex: 3 },
			]);
		});

		test("uses the same word index for emails in the same chunk", () => {
			const extractor = createExtractor();

			const matches = extractor.extractEmailMatches(
				"first@example.com,second@example.org",
			);

			expect(matches).toEqual([
				{ email: "first@example.com", wordIndex: 0 },
				{ email: "second@example.org", wordIndex: 0 },
			]);
		});

		test("excludes surrounding punctuation from each match", () => {
			const extractor = createExtractor();

			const matches = extractor.extractEmailMatches(
				"Reach <jane@example.com> today",
			);

			expect(matches).toEqual([{ email: "jane@example.com", wordIndex: 1 }]);
		});

		test("returns only the first occurrence of a duplicate email", () => {
			const extractor = createExtractor();

			const matches = extractor.extractEmailMatches(
				"jane@example.com then jane@example.com",
			);

			expect(matches).toEqual([{ email: "jane@example.com", wordIndex: 0 }]);
		});

		test("returns no matches when the text contains no emails", () => {
			const extractor = createExtractor();

			const matches = extractor.extractEmailMatches(
				"No contact details available",
			);

			expect(matches).toEqual([]);
		});

		test("returns no matches for whitespace-only text", () => {
			const extractor = createExtractor();

			const matches = extractor.extractEmailMatches(" \t\n ");

			expect(matches).toEqual([]);
		});

		test("produces the same result across repeated calls", () => {
			const extractor = createExtractor();
			const text = "Contact jane@example.com";

			extractor.extractEmailMatches(text);
			const matches = extractor.extractEmailMatches(text);

			expect(matches).toEqual([{ email: "jane@example.com", wordIndex: 1 }]);
		});
	});
});
