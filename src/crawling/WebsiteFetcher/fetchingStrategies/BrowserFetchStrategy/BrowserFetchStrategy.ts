import { Browser } from "playwright";
import {
	FetchResult,
	FetchStrategy,
	WebsiteFetcherConfig,
} from "../../websiteFetcher.types";

export class BrowserFetchStrategy implements FetchStrategy {
	constructor(private readonly browser: Browser) {}

	supports(url: string): boolean {
		return !/\.pdf(?:[?#]|$)/i.test(url);
	}

	async fetch(url: string, config: WebsiteFetcherConfig): Promise<FetchResult> {
		const page = await this.browser.newPage();

		try {
			const response = await page.goto(url, {
				waitUntil: "domcontentloaded",
				timeout: config.timeout,
			});

			if (!response || !response.ok()) {
				throw new Error(`HTTP ${response?.status()} for ${url}`);
			}

			const contentType = await response.headerValue("content-type");
			const buffer = Buffer.from(await page.content(), "utf-8");

			if (buffer.byteLength > config.maxContentLength) {
				throw new Error("Content exceeds maximum length");
			}

			return {
				data: buffer,
				contentType,
			};
		} finally {
			await page.close();
		}
	}
}
