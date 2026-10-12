import { describe, expect, test } from "vitest";
import { TextEmailExtractor } from "./TextEmailExtractor";

describe("TextEmailExtractor", () => {
	const extractor = new TextEmailExtractor();
	const getUniqueEmails = (emails: string[]): string[] => {
		return [...new Set(emails)];
	};

	test("extracts an email from text", () => {
		const text = "Contact jane@example.com for help.";
		const emails = extractor.extractEmails(text);
		const uniqueEmails = getUniqueEmails(emails);

		expect(uniqueEmails).toEqual(["jane@example.com"]);
	});

	test("extracts multiple emails in discovery order", () => {
		const text = "Email first@example.com or second@example.org.";
		const emails = extractor.extractEmails(text);
		const uniqueEmails = getUniqueEmails(emails);

		expect(uniqueEmails).toEqual(["first@example.com", "second@example.org"]);
	});

	test.each([
		["uppercase characters", "JANE.DOE@EXAMPLE.COM"],
		["a plus tag", "jane+sales@example.com"],
		["allowed local-part punctuation", "jane_doe%team@example.com"],
		["a subdomain", "jane@mail.example.co.uk"],
		["digits", "user123@example123.com"],
	])("extracts an address containing %s", (_, email) => {
		const text = `Contact ${email}.`;
		const emails = extractor.extractEmails(text);
		const uniqueEmails = getUniqueEmails(emails);

		expect(uniqueEmails).toEqual([email]);
	});

	test.each([
		["an empty string", ""],
		["plain text", "There is no contact address here."],
		["a missing domain", "Contact jane@."],
		["a missing local part", "Contact @example.com."],
		["a one-character top-level domain", "Contact jane@example.c."],
	])("returns no results for %s", (_, text) => {
		const emails = extractor.extractEmails(text);
		const uniqueEmails = getUniqueEmails(emails);

		expect(uniqueEmails).toEqual([]);
	});

	test("excludes surrounding punctuation from the result", () => {
		const text = "Reach us at <jane@example.com>. ";
		const emails = extractor.extractEmails(text);
		const uniqueEmails = getUniqueEmails(emails);

		expect(uniqueEmails).toEqual(["jane@example.com"]);
	});

	test("extracts emails separated by line breaks", () => {
		const text = "first@example.com\nsecond@example.org";
		const emails = extractor.extractEmails(text);
		const uniqueEmails = getUniqueEmails(emails);

		expect(uniqueEmails).toEqual(["first@example.com", "second@example.org"]);
	});

	test("produces the same result across repeated calls", () => {
		const text = "jane@example.com";

		extractor.extractEmails(text);
		const emails = extractor.extractEmails(text);
		const uniqueEmails = getUniqueEmails(emails);

		expect(uniqueEmails).toEqual(["jane@example.com"]);
	});
});
