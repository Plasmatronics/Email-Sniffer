import { afterEach, describe, expect, test, vi } from "vitest";
import { EmailExtractor } from "./EmailExtractor";
import { mockHTML } from "./mockHTML";

const MAX_CONTENT_LENGTH = 100;

describe("EmailExtractor", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	function createExtractor(
		maxContentLength = MAX_CONTENT_LENGTH,
	): EmailExtractor {
		return new EmailExtractor({ maxContentLength });
	}

	test("uses the default configuration when none is provided", () => {
		const extractor = new EmailExtractor();

		const emails = extractor.extractEmails("Contact jane@example.com");

		expect(emails).toEqual(["jane@example.com"]);
	});

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
		const extractor = new EmailExtractor();

		const emails = extractor.extractEmails(mockHTML);

		expect(emails).toEqual(["hello@linear.app"]);
	});

	test("does not truncate text at the configured maximum length", () => {
		const text = "jane@example.com";
		const extractor = createExtractor(text.length);

		const emails = extractor.extractEmails(text);

		expect(emails).toEqual(["jane@example.com"]);
	});

	test("does not warn when text is at the configured maximum length", () => {
		const text = "jane@example.com";
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		const extractor = createExtractor(text.length);

		extractor.extractEmails(text);

		expect(warn).not.toHaveBeenCalled();
	});

	test("does not extract emails beyond the configured maximum length", () => {
		vi.spyOn(console, "warn").mockImplementation(() => {});
		const extractor = createExtractor(7);
		const text = "prefix jane@example.com";

		const emails = extractor.extractEmails(text);

		expect(emails).toEqual([]);
	});

	test("warns with the omitted and configured character counts when truncating", () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		const extractor = createExtractor(5);

		extractor.extractEmails("123456789");

		expect(warn).toHaveBeenCalledWith(
			"Did not process the last 4 of this text because it surpassed the maxContentLength of 5",
		);
	});

	test("returns no emails when the maximum length is zero", () => {
		vi.spyOn(console, "warn").mockImplementation(() => {});
		const extractor = createExtractor(0);

		const emails = extractor.extractEmails("jane@example.com");

		expect(emails).toEqual([]);
	});

	test("produces the same result across repeated calls", () => {
		const extractor = createExtractor();
		const text = "jane@example.com";

		extractor.extractEmails(text);
		const emails = extractor.extractEmails(text);

		expect(emails).toEqual(["jane@example.com"]);
	});
});
