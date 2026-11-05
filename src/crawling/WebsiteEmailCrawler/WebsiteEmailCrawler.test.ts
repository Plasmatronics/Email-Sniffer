import { beforeEach, describe, expect, test, vi } from "vitest";
import { DocumentClamper } from "../../processing/DocumentClamper";
import { EmailExtractor } from "../../processing/EmailExtractor";
import { TextChunker } from "../../processing/TextChunker";
import { EmailPattern } from "../../shared";
import { EmailPatternInferrer } from "../../email-inference/EmailPatternInferrer";
import type { ParserStrategy } from "../parsers";
import {
	DEFAULT_WEBSITE_FETCHER_CONFIG,
	type FetchResult,
	type WebsiteFetcher,
	type WebsiteFetcherConfig,
} from "../WebsiteFetcher";
import {
	MAX_ALLOWED_PAGE_ATTEMPTS,
	WebsiteEmailCrawler,
	type WebsiteEmailCrawlerConfig,
} from "./WebsiteEmailCrawler";

const { fetch } = vi.hoisted(() => ({ fetch: vi.fn() }));

const SEED_URL = "https://example.com/";

function crawlConfig(
	maxPages: number,
	overrides: Partial<WebsiteFetcherConfig> = {},
): WebsiteEmailCrawlerConfig {
	return {
		...DEFAULT_WEBSITE_FETCHER_CONFIG,
		maxPages,
		...overrides,
	};
}

function createResponse(
	data = Buffer.alloc(0),
	contentType: string | null = "text/html",
): FetchResult {
	return {
		data,
		contentType,
	};
}

describe("WebsiteEmailCrawler", () => {
	const supports = vi.fn<ParserStrategy["supports"]>();
	const parse = vi.fn<ParserStrategy["parse"]>();
	const strategy: ParserStrategy = { supports, parse };

	function createCrawler() {
		return new WebsiteEmailCrawler(
			[strategy],
			new EmailExtractor(new TextChunker(), new DocumentClamper()),
			new EmailPatternInferrer(new TextChunker()),
			{ fetch } as WebsiteFetcher,
		);
	}

	beforeEach(() => {
		fetch.mockReset();
		supports.mockReset();
		parse.mockReset();
		fetch.mockResolvedValue(createResponse());
		supports.mockReturnValue(true);
		parse.mockResolvedValue({ links: [], text: "" });
		vi.spyOn(console, "warn").mockImplementation(() => {});
	});

	test("extracts emails from parsed text and encoded mailto links", async () => {
		parse.mockResolvedValue({
			links: ["mailto:alice.brown%40example.com?subject=Hello"],
			text: "Contact Alice Brown at alice.brown@example.com",
		});
		const crawler = createCrawler();

		await expect(crawler.crawl(SEED_URL, crawlConfig(1))).resolves.toEqual({
			[SEED_URL]: [
				{
					email: "alice.brown@example.com",
					pattern: EmailPattern.FirstNameDotLastName,
				},
			],
		});
	});

	test("retains an extracted email when no employee pattern can be inferred", async () => {
		parse.mockResolvedValue({
			links: [],
			text: "Please email privacy@example.com",
		});
		const crawler = createCrawler();

		await expect(crawler.crawl(SEED_URL, crawlConfig(1))).resolves.toEqual({
			[SEED_URL]: [
				{ email: "privacy@example.com", pattern: EmailPattern.Unknown },
			],
		});
	});

	test("traverses each normalized same-origin HTTP link once", async () => {
		parse
			.mockResolvedValueOnce({
				links: [
					"/contact#team",
					"https://example.com/contact#support",
					"https://outside.example/contact",
					"tel:+15555550100",
					"javascript:void(0)",
					"http://[",
					" ",
				],
				text: "",
			})
			.mockResolvedValue({ links: [], text: "" });
		const crawler = createCrawler();

		await crawler.crawl(SEED_URL, crawlConfig(5));

		expect(fetch.mock.calls.map(([url]) => url)).toEqual([
			SEED_URL,
			"https://example.com/contact",
		]);
	});

	test("visits higher-weighted pages first", async () => {
		parse
			.mockResolvedValueOnce({
				links: ["/news", "/contact", "/about"],
				text: "",
			})
			.mockResolvedValue({ links: [], text: "" });
		const crawler = createCrawler();

		await crawler.crawl(SEED_URL, crawlConfig(4));

		expect(fetch.mock.calls.map(([url]) => url)).toEqual([
			SEED_URL,
			"https://example.com/contact",
			"https://example.com/about",
			"https://example.com/news",
		]);
	});

	test.each([
		{ label: "zero", maxPages: 0, expectedRequests: 1 },
		{ label: "NaN", maxPages: Number.NaN, expectedRequests: 1 },
		{ label: "a fraction", maxPages: 2.9, expectedRequests: 2 },
		{ label: "a value above the maximum", maxPages: 25, expectedRequests: 20 },
	])("normalizes $label page limit", async ({ maxPages, expectedRequests }) => {
		fetch.mockImplementation(async (url: string) =>
			createResponse(Buffer.from(url)),
		);
		parse.mockImplementation(async (content) => {
			const currentUrl = new URL(content.toString());
			const page = Number(currentUrl.pathname.slice(1) || 0);

			return { links: [`/${page + 1}`], text: "" };
		});
		const crawler = createCrawler();

		await crawler.crawl(SEED_URL, crawlConfig(maxPages));

		expect(fetch).toHaveBeenCalledTimes(expectedRequests);
	});

	test("forces safe response and redirect options", async () => {
		const crawler = createCrawler();

		await crawler.crawl(
			SEED_URL,
			crawlConfig(1, { maxContentLength: 2_000_000, timeout: 500 }),
		);

		expect(fetch).toHaveBeenCalledWith(
			SEED_URL,
			expect.objectContaining({
				maxContentLength: 1_000_000,
				timeout: 500,
			}),
		);
	});

	test("preserves a caller-provided response limit below the maximum", async () => {
		const crawler = createCrawler();

		await crawler.crawl(SEED_URL, crawlConfig(1, { maxContentLength: 25_000 }));

		expect(fetch).toHaveBeenCalledWith(
			SEED_URL,
			expect.objectContaining({ maxContentLength: 25_000 }),
		);
	});

	test("skips a response with no matching parser strategy", async () => {
		supports.mockReturnValue(false);
		const crawler = createCrawler();

		await expect(crawler.crawl(SEED_URL, crawlConfig(1))).resolves.toEqual({});
		expect(parse).not.toHaveBeenCalled();
	});

	test("continues after a parser failure", async () => {
		parse.mockRejectedValue(new Error("Invalid content"));
		const crawler = createCrawler();

		await expect(crawler.crawl(SEED_URL, crawlConfig(1))).resolves.toEqual({});
		expect(console.warn).toHaveBeenCalledWith("Invalid content");
	});

	test("continues after a fetch failure", async () => {
		fetch.mockRejectedValue(new Error("Request failed"));
		const crawler = createCrawler();

		await expect(crawler.crawl(SEED_URL, crawlConfig(1))).resolves.toEqual({});
		expect(console.warn).toHaveBeenCalledWith(
			`Failed to fetch ${SEED_URL}: Request failed`,
		);
	});

	test("stops after the maximum number of page attempts", async () => {
		fetch
			.mockResolvedValueOnce(createResponse())
			.mockRejectedValue(new Error("Request failed"));
		parse.mockResolvedValueOnce({
			links: Array.from({ length: 100 }, (_, index) => `/page-${index}`),
			text: "",
		});
		const crawler = createCrawler();

		await expect(crawler.crawl(SEED_URL, crawlConfig(20))).resolves.toEqual({
			[SEED_URL]: [],
		});
		expect(fetch).toHaveBeenCalledTimes(MAX_ALLOWED_PAGE_ATTEMPTS);
	});
});
