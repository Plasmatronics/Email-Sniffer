import { BrowserContext } from "playwright";
import {
	FetchResult,
	FetchStrategy,
	WebsiteFetcherConfig,
} from "../../websiteFetcher.types";

export class HTTPFetchStrategy implements FetchStrategy {
	constructor(private readonly context: BrowserContext) {}

	supports(url: string): boolean {
		return /\.pdf(?:[?#]|$)/i.test(url);
	}

	async fetch(url: string, config: WebsiteFetcherConfig): Promise<FetchResult> {
		const response = await this.context.request.get(url, {
			timeout: config.timeout,
		});

		if (!response.ok()) {
			throw new Error(`HTTP ${response.status()} for ${url}`);
		}

		const buffer = Buffer.from(await response.body());
		if (buffer.byteLength > config.maxContentLength) {
			throw new Error("Content exceeds maximum length");
		}

		return {
			data: buffer,
			contentType: response.headers()["content-type"] ?? null,
		};
	}
}
