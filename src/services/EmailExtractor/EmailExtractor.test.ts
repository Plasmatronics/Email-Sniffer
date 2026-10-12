import { afterEach, describe, expect, test, vi } from "vitest";
import { EmailExtractor, type EmailExtractionStrategy } from "./EmailExtractor";

const MAX_CONTENT_LENGTH = 100;

describe("EmailExtractor", () => {
	const extractEmails = vi.fn<EmailExtractionStrategy["extractEmails"]>();

	afterEach(() => {
		vi.restoreAllMocks();
		extractEmails.mockReset();
	});

	function createExtractor(
		maxContentLength = MAX_CONTENT_LENGTH,
	): EmailExtractor {
		return new EmailExtractor({ extractEmails }, { maxContentLength });
	}

	test("delegates extraction to the configured strategy", () => {
		extractEmails.mockReturnValue(["jane@example.com"]);
		const extractor = createExtractor();

		extractor.extractEmails("Contact jane@example.com");

		expect(extractEmails).toHaveBeenCalledWith("Contact jane@example.com");
	});

	test("returns emails produced by the configured strategy", () => {
		extractEmails.mockReturnValue(["jane@example.com", "john@example.org"]);
		const extractor = createExtractor();

		expect(extractor.extractEmails("content")).toEqual([
			"jane@example.com",
			"john@example.org",
		]);
	});

	test("returns an empty collection when the strategy finds no emails", () => {
		extractEmails.mockReturnValue([]);
		const extractor = createExtractor();

		expect(extractor.extractEmails("content without an email")).toEqual([]);
	});

	test("removes duplicate strategy results while preserving discovery order", () => {
		extractEmails.mockReturnValue([
			"first@example.com",
			"second@example.com",
			"first@example.com",
		]);
		const extractor = createExtractor();

		expect(extractor.extractEmails("content")).toEqual([
			"first@example.com",
			"second@example.com",
		]);
	});

	test("passes content at the configured maximum length without truncating it", () => {
		extractEmails.mockReturnValue([]);
		const extractor = createExtractor(5);

		extractor.extractEmails("12345");

		expect(extractEmails).toHaveBeenCalledWith("12345");
	});

	test("does not warn when content is at the configured maximum length", () => {
		extractEmails.mockReturnValue([]);
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		const extractor = createExtractor(5);

		extractor.extractEmails("12345");

		expect(warn).not.toHaveBeenCalled();
	});

	test("truncates content before passing it to the strategy", () => {
		extractEmails.mockReturnValue([]);
		vi.spyOn(console, "warn").mockImplementation(() => {});
		const extractor = createExtractor(5);

		extractor.extractEmails("123456789");

		expect(extractEmails).toHaveBeenCalledWith("12345");
	});

	test("warns with the omitted and configured character counts when truncating", () => {
		extractEmails.mockReturnValue([]);
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		const extractor = createExtractor(5);

		extractor.extractEmails("123456789");

		expect(warn).toHaveBeenCalledWith(
			"Did not process the last 4 of this string because it surpassed the maxContentLength of 5",
		);
	});

	test("passes an empty string to the strategy when the maximum length is zero", () => {
		extractEmails.mockReturnValue([]);
		vi.spyOn(console, "warn").mockImplementation(() => {});
		const extractor = createExtractor(0);

		extractor.extractEmails("content");

		expect(extractEmails).toHaveBeenCalledWith("");
	});

	test("propagates strategy failures", () => {
		const strategyError = new Error("extraction failed");
		extractEmails.mockImplementation(() => {
			throw strategyError;
		});
		const extractor = createExtractor();

		expect(() => extractor.extractEmails("content")).toThrow(strategyError);
	});
});
