import { AxiosError, AxiosHeaders, type AxiosResponse } from "axios";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { DocumentClamper } from "../DocumentClamper";
import { EmailExtractor } from "../EmailExtractor";
import { TextChunker } from "../TextChunker";
import { EmailPattern } from "../../shared";
import { EmailPatternInferrer } from "../EmailPatternInferrer";
import type { ParserStrategy } from "./ParserStrategy";
import { WebsiteEmailCrawler } from "./WebsiteEmailCrawler";

const { get } = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock("axios", async (importOriginal) => {
	const actual = await importOriginal<typeof import("axios")>();

	return {
		...actual,
		default: {
			...actual.default,
			get,
			isAxiosError: actual.default.isAxiosError,
		},
	};
});

const SEED_URL = "https://example.com/";

function createResponse(
	data = Buffer.alloc(0),
	contentType: string | undefined = "text/html",
): AxiosResponse<Buffer> {
	return {
		data,
		status: 200,
		statusText: "OK",
		headers: contentType ? { "content-type": contentType } : {},
		config: { headers: new AxiosHeaders() },
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
		);
	}

	beforeEach(() => {
		get.mockReset();
		supports.mockReset();
		parse.mockReset();
		get.mockResolvedValue(createResponse());
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

		await expect(crawler.crawl(SEED_URL, { maxPages: 1 })).resolves.toEqual({
			[SEED_URL]: [
				{
					email: "alice.brown@example.com",
					pattern: EmailPattern.FirstNameDotLastName,
				},
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

		await crawler.crawl(SEED_URL, { maxPages: 5 });

		expect(get.mock.calls.map(([url]) => url)).toEqual([
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

		await crawler.crawl(SEED_URL, { maxPages: 4 });

		expect(get.mock.calls.map(([url]) => url)).toEqual([
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
		get.mockImplementation(async (url: string) =>
			createResponse(Buffer.from(url)),
		);
		parse.mockImplementation(async (content) => {
			const currentUrl = new URL(content.toString());
			const page = Number(currentUrl.pathname.slice(1) || 0);

			return { links: [`/${page + 1}`], text: "" };
		});
		const crawler = createCrawler();

		await crawler.crawl(SEED_URL, { maxPages });

		expect(get).toHaveBeenCalledTimes(expectedRequests);
	});

	test("forces safe response and redirect options", async () => {
		const crawler = createCrawler();

		await crawler.crawl(SEED_URL, {
			maxPages: 1,
			maxContentLength: 2_000_000,
			maxRedirects: 10,
			timeout: 500,
		});

		expect(get).toHaveBeenCalledWith(
			SEED_URL,
			expect.objectContaining({
				maxContentLength: 1_000_000,
				maxRedirects: 0,
				responseType: "arraybuffer",
				timeout: 500,
			}),
		);
	});

	test("preserves a caller-provided response limit below the maximum", async () => {
		const crawler = createCrawler();

		await crawler.crawl(SEED_URL, {
			maxPages: 1,
			maxContentLength: 25_000,
		});

		expect(get).toHaveBeenCalledWith(
			SEED_URL,
			expect.objectContaining({ maxContentLength: 25_000 }),
		);
	});

	test("skips a response with no matching parser strategy", async () => {
		supports.mockReturnValue(false);
		const crawler = createCrawler();

		await expect(crawler.crawl(SEED_URL, { maxPages: 1 })).resolves.toEqual({});
		expect(parse).not.toHaveBeenCalled();
	});

	test("continues after a parser failure", async () => {
		parse.mockRejectedValue(new Error("Invalid content"));
		const crawler = createCrawler();

		await expect(crawler.crawl(SEED_URL, { maxPages: 1 })).resolves.toEqual({});
		expect(console.warn).toHaveBeenCalledWith("Invalid content");
	});

	test("continues after an Axios request failure", async () => {
		get.mockRejectedValue(new AxiosError("Request failed"));
		const crawler = createCrawler();

		await expect(crawler.crawl(SEED_URL, { maxPages: 1 })).resolves.toEqual({});
		expect(console.warn).toHaveBeenCalledWith(
			`Failed to fetch ${SEED_URL}: Request failed`,
		);
	});
});
