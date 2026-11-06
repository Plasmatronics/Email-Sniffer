import { chromium } from "playwright-extra";
import type { Browser, Page, Response } from "playwright";
import { describe, expect, test, vi } from "vitest";
import { PlaywrightWebsiteFetcher } from "./PlaywrightWebsiteFetcher";

const launch = vi.spyOn(chromium, "launch");

vi.mock("puppeteer-extra-plugin-stealth", () => ({
	default: vi.fn(() => ({ name: "stealth" })),
}));

const config = {
	maxContentLength: 1_000,
	timeout: 5_000,
};

async function createFetcher(
	overrides: {
		content?: string;
		response?: Partial<Response> | null;
	} = {},
) {
	const page = {
		goto: vi.fn().mockResolvedValue(
			overrides.response !== undefined
				? overrides.response
				: {
						ok: () => true,
						status: () => 200,
						headerValue: vi.fn().mockResolvedValue("text/html; charset=utf-8"),
					},
		),
		content: vi
			.fn()
			.mockResolvedValue(overrides.content ?? "<body>content</body>"),
		close: vi.fn().mockResolvedValue(undefined),
	} as unknown as Page;
	const browser = {
		newPage: vi.fn().mockResolvedValue(page),
		close: vi.fn().mockResolvedValue(undefined),
	} as unknown as Browser;

	launch.mockResolvedValue(browser);

	return {
		fetcher: await PlaywrightWebsiteFetcher.createFetcher({}),
		browser,
		page,
	};
}

describe("PlaywrightWebsiteFetcher", () => {
	test("fetches page content and response content type", async () => {
		const { fetcher, browser, page } = await createFetcher();

		await expect(fetcher.fetch("https://example.com", config)).resolves.toEqual(
			{
				data: Buffer.from("<body>content</body>"),
				contentType: "text/html; charset=utf-8",
			},
		);
		expect(browser.newPage).toHaveBeenCalledOnce();
		expect(launch).toHaveBeenCalledWith({ headless: true });
		expect(page.goto).toHaveBeenCalledWith("https://example.com", {
			waitUntil: "domcontentloaded",
			timeout: 5_000,
		});
	});

	test("closes the page after a successful fetch", async () => {
		const { fetcher, page } = await createFetcher();

		await fetcher.fetch("https://example.com", config);

		expect(page.close).toHaveBeenCalledOnce();
	});

	test("closes the page when navigation fails", async () => {
		const { fetcher, page } = await createFetcher();
		vi.mocked(page.goto).mockRejectedValueOnce(new Error("navigation failed"));

		await expect(fetcher.fetch("https://example.com", config)).rejects.toThrow(
			"navigation failed",
		);
		expect(page.close).toHaveBeenCalledOnce();
	});

	test("rejects an unsuccessful HTTP response", async () => {
		const { fetcher, page } = await createFetcher({
			response: {
				ok: () => false,
				status: () => 404,
			},
		});

		await expect(
			fetcher.fetch("https://example.com/missing", config),
		).rejects.toThrow("HTTP 404 for https://example.com/missing");
		expect(page.close).toHaveBeenCalledOnce();
	});

	test("rejects when Playwright returns no response", async () => {
		const { fetcher } = await createFetcher({ response: null });

		await expect(fetcher.fetch("https://example.com", config)).rejects.toThrow(
			"HTTP undefined for https://example.com",
		);
	});

	test("rejects content larger than the configured maximum", async () => {
		const { fetcher, page } = await createFetcher({ content: "123456" });

		await expect(
			fetcher.fetch("https://example.com", { ...config, maxContentLength: 5 }),
		).rejects.toThrow("Content exceeds maximum length");
		expect(page.close).toHaveBeenCalledOnce();
	});

	test("closes the browser", async () => {
		const { fetcher, browser } = await createFetcher();

		await fetcher.close();

		expect(browser.close).toHaveBeenCalledOnce();
	});
});
