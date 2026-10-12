import { describe, expect, test } from "vitest";
import { HTMLEmailExtractor } from "./HTMLEmailExtractor";
import { mockHTML } from "./mockHTML";

describe("HTMLEmailExtractor", () => {
	const extractor = new HTMLEmailExtractor();
	const getUniqueEmails = (emails: string[]): string[] => {
		return [...new Set(emails)];
	};

	test("extracts an email from visible HTML text", () => {
		const html = "<p>Contact jane@example.com for help.</p>";
		const emails = extractor.extractEmails(html);
		const uniqueEmails = getUniqueEmails(emails);

		expect(uniqueEmails).toEqual(["jane@example.com"]);
	});

	test("extracts multiple emails in document order", () => {
		const html = `
			<p>Sales: sales@example.com</p>
			<p>Support: support@example.org</p>
		`;
		const emails = extractor.extractEmails(html);
		const uniqueEmails = getUniqueEmails(emails);

		expect(uniqueEmails).toEqual(["sales@example.com", "support@example.org"]);
	});

	test("extracts an email from a non-mailto attribute", () => {
		const html = '<div data-contact="jane@example.com"></div>';
		const emails = extractor.extractEmails(html);
		const uniqueEmails = getUniqueEmails(emails);

		expect(uniqueEmails).toEqual(["jane@example.com"]);
	});

	test("extracts an email from a mailto link", () => {
		const html = '<a href="mailto:jane@example.com">Email Jane</a>';
		const emails = extractor.extractEmails(html);
		const uniqueEmails = getUniqueEmails(emails);

		expect(uniqueEmails).toEqual(["jane@example.com"]);
	});

	test("excludes mailto query parameters from the result", () => {
		const html =
			'<a href="mailto:jane@example.com?subject=Hello&amp;body=Welcome">Email Jane</a>';
		const emails = extractor.extractEmails(html);
		const uniqueEmails = getUniqueEmails(emails);

		expect(uniqueEmails).toEqual(["jane@example.com"]);
	});

	test("extracts multiple recipients from a mailto link", () => {
		const html =
			'<a href="mailto:first@example.com,second@example.org">Email the team</a>';
		const emails = extractor.extractEmails(html);
		const uniqueEmails = getUniqueEmails(emails);

		expect(uniqueEmails).toEqual(["first@example.com", "second@example.org"]);
	});

	test("extracts an email from malformed HTML", () => {
		const html = "<main><p>Contact jane@example.com</main>";
		const emails = extractor.extractEmails(html);
		const uniqueEmails = getUniqueEmails(emails);

		expect(uniqueEmails).toEqual(["jane@example.com"]);
	});

	test("extracts an email from an HTML fragment", () => {
		const html = "Contact jane@example.com";
		const emails = extractor.extractEmails(html);
		const uniqueEmails = getUniqueEmails(emails);

		expect(uniqueEmails).toEqual(["jane@example.com"]);
	});

	test.each([
		["an empty string", ""],
		["HTML without an email", "<p>No contact address is available.</p>"],
		["an incomplete email", "<p>Contact jane@example</p>"],
	])("returns no results for %s", (_, html) => {
		const emails = extractor.extractEmails(html);
		const uniqueEmails = getUniqueEmails(emails);

		expect(uniqueEmails).toEqual([]);
	});

	test("Extract email from realistic html", () => {
		const emails = extractor.extractEmails(mockHTML);
		const uniqueEmails = getUniqueEmails(emails);

		expect(uniqueEmails).toEqual(["hello@linear.app"]);
	});
});
