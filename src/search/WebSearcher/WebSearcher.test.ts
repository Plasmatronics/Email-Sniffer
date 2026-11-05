import { afterEach, describe, expect, test, vi } from "vitest";
import type { WebSearchClient } from "../../integrations";
import type { WebSearchResult } from "../../types";
import { WebSearcher } from "./WebSearcher";

const pdfResult: WebSearchResult = {
	title: "Example annual report",
	link: "https://example.com/annual-report.pdf",
	position: 1,
};
const contactResult: WebSearchResult = {
	title: "Contact Example",
	link: "https://example.com/contact",
	position: 1,
};

describe("WebSearcher", () => {
	const search = vi.fn<WebSearchClient["search"]>();

	afterEach(() => {
		vi.restoreAllMocks();
		search.mockReset();
	});

	test("searches for PDF and contact results", async () => {
		search.mockResolvedValue([]);
		vi.spyOn(console, "error").mockImplementation(() => {});
		const searcher = new WebSearcher({ search });

		await expect(searcher.fetchResults("Example Company")).resolves.toEqual([]);

		expect(search.mock.calls).toEqual([
			["Example Company filetype:pdf"],
			["Example Company contact"],
		]);
	});

	test("combines results from every successful query", async () => {
		search
			.mockResolvedValueOnce([pdfResult])
			.mockResolvedValueOnce([contactResult]);
		const searcher = new WebSearcher({ search });

		await expect(searcher.fetchResults("Example Company")).resolves.toEqual([
			pdfResult,
			contactResult,
		]);
	});

	test("returns available results when one query fails", async () => {
		const searchError = new Error("Search request failed");
		search
			.mockRejectedValueOnce(searchError)
			.mockResolvedValueOnce([contactResult]);
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		const searcher = new WebSearcher({ search });

		await expect(searcher.fetchResults("Example Company")).resolves.toEqual([
			contactResult,
		]);
		expect(warn).toHaveBeenCalledWith(searchError);
	});

	test("returns no results when every query fails", async () => {
		search.mockRejectedValue(new Error("Search request failed"));
		vi.spyOn(console, "error").mockImplementation(() => {});
		const searcher = new WebSearcher({ search });

		await expect(searcher.fetchResults("Example Company")).resolves.toEqual([]);
	});

	test("returns no results when successful queries return no results", async () => {
		search.mockResolvedValue([]);
		vi.spyOn(console, "error").mockImplementation(() => {});
		const searcher = new WebSearcher({ search });

		await expect(searcher.fetchResults("Example Company")).resolves.toEqual([]);
	});
});
