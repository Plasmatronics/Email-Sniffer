import { chromium } from "playwright-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import {
	FetchResult,
	WebsiteFetcher,
	WebsiteFetcherConfig,
} from "../websiteFetcher.types";
import { Browser, LaunchOptions } from "playwright";
import { logger } from "../../../infrastructure";

export class PlaywrightWebsiteFetcher implements WebsiteFetcher {
	private readonly serviceName = "PlaywrightWebsiteFetcher";

	private constructor(private readonly browser: Browser) {}

	static async createFetcher(
		options: LaunchOptions,
	): Promise<PlaywrightWebsiteFetcher> {
		try {
			chromium.use(StealthPlugin());
			const browser = await chromium.launch({
				...options,
				headless: true,
			});

			return new PlaywrightWebsiteFetcher(browser);
		} catch (err: unknown) {
			throw new Error(
				`There was an error creating the fetcher: ${err instanceof Error ? err.message : "An unknown error has occurred."}`,
				{ cause: err },
			);
		}
	}

	async fetch(url: string, config: WebsiteFetcherConfig): Promise<FetchResult> {
		const start = Date.now();
		const childLogger = logger.child({ serviceName: this.serviceName, url });
		childLogger.debug("Fetching website");

		const page = await this.browser.newPage();

		try {
			const response = await page.goto(url, {
				waitUntil: "domcontentloaded",
				timeout: config.timeout,
			});

			if (!response || !response?.ok()) {
				throw new Error(`HTTP ${response?.status()} for ${url}`);
			}

			const buffer = Buffer.from(await page.content(), "utf-8");
			if (buffer.byteLength > config.maxContentLength) {
				throw new Error("Content exceeds maximum length");
			}

			childLogger.debug(
				{
					statusCode: response.status(),
					contentLength: buffer.byteLength,
					durationMs: Math.round(Date.now() - start),
				},
				"Website fetched successfully",
			);

			return {
				data: buffer,
				contentType: await response.headerValue("content-type"),
			};
		} finally {
			await page.close();
		}
	}

	async close(): Promise<void> {
		await this.browser.close();
	}
}
