import { chromium } from "playwright-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import {
	FetchResult,
	FetchStrategy,
	WebsiteFetcher,
	WebsiteFetcherConfig,
} from "../websiteFetcher.types";
import { Browser, BrowserContext, LaunchOptions } from "playwright";
import { logger } from "../../../infrastructure";
import { BrowserFetchStrategy, HTTPFetchStrategy } from "../fetchingStrategies";

export class PlaywrightWebsiteFetcher implements WebsiteFetcher {
	private readonly serviceName = "PlaywrightWebsiteFetcher";

	private constructor(
		private readonly browser: Browser,
		private readonly context: BrowserContext,
		private readonly fetchingStrategies: FetchStrategy[],
	) {}

	static async createFetcher(
		options: LaunchOptions,
		fetchingStrategies?: FetchStrategy[],
	): Promise<PlaywrightWebsiteFetcher> {
		try {
			chromium.use(StealthPlugin());
			const browser = await chromium.launch({
				...options,
				headless: process.env.NODE_ENV === "production" ? true : false,
			});
			const context = await browser.newContext();

			return new PlaywrightWebsiteFetcher(
				browser,
				context,
				fetchingStrategies ?? [
					new HTTPFetchStrategy(context),
					new BrowserFetchStrategy(browser),
				],
			);
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

		try {
			const fetchStrategy = this.delegateFetchingStrategy(url);
			const result = await fetchStrategy.fetch(url, config);
			childLogger.debug(
				{
					contentLength: result.data.byteLength,
					durationMs: Math.round(Date.now() - start),
				},
				"Website fetched successfully",
			);
			return result;
		} catch (err: unknown) {
			childLogger.error(
				{ err, durationMs: Date.now() - start },
				"Website fetch failed",
			);
			throw err;
		}
	}

	private delegateFetchingStrategy(url: string): FetchStrategy {
		const strategy = this.fetchingStrategies.find((candidate) =>
			candidate.supports(url),
		);
		if (!strategy) throw new Error(`No fetch strategy supports ${url}`);

		return strategy;
	}

	async close(): Promise<void> {
		await this.context.close();
		await this.browser.close();
	}
}
