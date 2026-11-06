import { chromium, Browser, LaunchOptions } from "playwright";
import {
	FetchResult,
	WebsiteFetcher,
	WebsiteFetcherConfig,
} from "../websiteFetcher.types";

export class PlaywrightWebsiteFetcher implements WebsiteFetcher {
	constructor(private readonly browser: Browser) {}

	static async createFetcher(
		options: LaunchOptions,
	): Promise<PlaywrightWebsiteFetcher> {
		const browser = await chromium.launch({
			headless: true,
			...options,
		});

		return new PlaywrightWebsiteFetcher(browser);
	}

	async fetch(url: string, config: WebsiteFetcherConfig): Promise<FetchResult> {
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
