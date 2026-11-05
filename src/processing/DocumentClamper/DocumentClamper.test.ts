import { afterEach, describe, expect, test, vi } from "vitest";
import { DEFAULT_CLAMP_LENGTH, DocumentClamper } from "./DocumentClamper";

describe("DocumentClamper", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	test("returns an empty document unchanged", () => {
		const clamper = new DocumentClamper();

		const result = clamper.clamp("");

		expect(result).toBe("");
	});

	test("returns a document shorter than the clamp length unchanged", () => {
		const clamper = new DocumentClamper();

		const result = clamper.clamp("short document", 20);

		expect(result).toBe("short document");
	});

	test("returns a document at the clamp length unchanged", () => {
		const clamper = new DocumentClamper();

		const result = clamper.clamp("12345", 5);

		expect(result).toBe("12345");
	});

	test("truncates a document longer than the clamp length", () => {
		vi.spyOn(console, "warn").mockImplementation(() => {});
		const clamper = new DocumentClamper();

		const result = clamper.clamp("123456789", 5);

		expect(result).toBe("12345");
	});

	test("uses the default clamp length when no length is provided", () => {
		vi.spyOn(console, "warn").mockImplementation(() => {});
		const clamper = new DocumentClamper();
		const document = "a".repeat(DEFAULT_CLAMP_LENGTH + 1);

		const result = clamper.clamp(document);

		expect(result).toHaveLength(DEFAULT_CLAMP_LENGTH);
	});

	test("returns an empty document when the clamp length is zero", () => {
		vi.spyOn(console, "warn").mockImplementation(() => {});
		const clamper = new DocumentClamper();

		const result = clamper.clamp("document", 0);

		expect(result).toBe("");
	});

	test("warns with the omitted and configured character counts when truncating", () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		const clamper = new DocumentClamper();

		clamper.clamp("123456789", 5);

		expect(warn).toHaveBeenCalledWith(
			"Did not process the last 4 of this text because it surpassed the maxContentLength of 5",
		);
	});

	test("does not warn when the document is at the clamp length", () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		const clamper = new DocumentClamper();

		clamper.clamp("12345", 5);

		expect(warn).not.toHaveBeenCalled();
	});
});
