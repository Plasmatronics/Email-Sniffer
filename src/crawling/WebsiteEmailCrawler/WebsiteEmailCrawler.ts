import { EmailExtractor } from "../../processing/EmailExtractor";
import { ParserStrategy } from "../parsers";
import { MaxHeap } from "mnemonist";
import { getKeywordsFromUrl, getUrlWeightFromKeywords } from "../../utils";
import { PAGE_WEIGHTS } from "./pageWeights";
import { PatternInference } from "../../shared";
import { EmailPatternInferrer } from "../../email-inference/EmailPatternInferrer";
import {
	FetchResult,
	WebsiteFetcher,
	WebsiteFetcherConfig,
} from "../WebsiteFetcher";

export const MAX_ALLOWED_PAGE_ATTEMPTS = 50;
const MAX_ALLOWED_PAGES = 20;
const MIN_ALLOWED_PAGES = 1;
const MAX_CONTENT_LENGTH = 10_000_000;

export interface WebsiteEmailCrawlerConfig extends WebsiteFetcherConfig {
	maxPages: number;
}

export type CrawlResult = Record<string, PatternInference[]>;

export class WebsiteEmailCrawler {
	constructor(
		private readonly parserStrategies: ParserStrategy[],
		private readonly emailExtractor: EmailExtractor,
		private readonly patternInferrer: EmailPatternInferrer,
		private readonly websiteFetcher: WebsiteFetcher,
	) {}

	private normalizeConfig(
		config: WebsiteEmailCrawlerConfig,
	): WebsiteEmailCrawlerConfig {
		const { maxPages, ...fetcherConfig } = config;
		const normalizedMaxPages = Math.min(
			Math.max(
				MIN_ALLOWED_PAGES,
				maxPages ? Math.floor(maxPages) : MIN_ALLOWED_PAGES,
			),
			MAX_ALLOWED_PAGES,
		);

		return {
			...fetcherConfig,
			maxPages: normalizedMaxPages,
			maxContentLength: Math.min(
				fetcherConfig.maxContentLength ?? MAX_CONTENT_LENGTH,
				MAX_CONTENT_LENGTH,
			),
		};
	}

	async crawl(
		url: string,
		config: WebsiteEmailCrawlerConfig,
	): Promise<CrawlResult> {
		const { maxPages, ...fetcherConfig } = this.normalizeConfig(config);

		const crawlResults: CrawlResult = {};

		let numProcessed = 0;
		let numAttempts = 0;
		const seen = new Set<string>();
		const maxHeap = new MaxHeap<[string, number]>((a, b) => a[1] - b[1]);
		maxHeap.push([url, 100]);
		seen.add(url);

		while (maxHeap.size) {
			if (
				numProcessed === maxPages ||
				numAttempts === MAX_ALLOWED_PAGE_ATTEMPTS
			)
				break;

			const [poppedUrl] = maxHeap.pop()!;
			numAttempts++;

			let res: FetchResult;
			try {
				res = await this.websiteFetcher.fetch(poppedUrl, fetcherConfig);
			} catch (error) {
				console.warn(
					`Failed to fetch ${poppedUrl}: ${error instanceof Error ? error.message : "An unknown error occurred."}`,
				);

				continue;
			}

			const strategy = this.delegateStrategy(res.contentType ?? "");
			if (!strategy) {
				console.warn(
					`We are not able to process ${poppedUrl} because it doesnt have a content type we can process`,
				);

				continue;
			}

			let links: string[];
			let text: string;
			try {
				const strategyRes = await strategy.parse(res.data);
				links = strategyRes.links;
				text = strategyRes.text;
			} catch (err: unknown) {
				console.warn(
					`${err instanceof Error ? err.message : `An unknown error has occurred whilst parsing the content for ${poppedUrl}`}`,
				);

				continue;
			}

			const traversableLinks = this.getTraversableLinks(links, poppedUrl);
			const textExtractedEmails = this.emailExtractor.extractEmailMatches(text);

			crawlResults[poppedUrl] = this.patternInferrer.inferEmailPatterns(
				textExtractedEmails,
				text,
			);

			for (const nextLink of traversableLinks) {
				if (seen.has(nextLink)) continue;
				seen.add(nextLink);

				let weight;
				try {
					const urlKeywords = getKeywordsFromUrl(nextLink);
					weight = getUrlWeightFromKeywords(urlKeywords, PAGE_WEIGHTS);
				} catch (err: unknown) {
					console.warn(
						`Failed to get URL weight for ${nextLink}: ${err instanceof Error ? err.message : "An unknown error occurred."}`,
					);

					continue;
				}

				maxHeap.push([nextLink, weight]);
			}

			numProcessed++;
		}

		return crawlResults;
	}

	private getTraversableLinks(links: string[], baseUrl: string): string[] {
		const base = new URL(baseUrl);
		const traversableLinks = new Set<string>();

		for (const link of links) {
			const href = link.trim();
			if (!href) continue;

			let url: URL;
			try {
				url = new URL(href, base);
			} catch {
				continue;
			}

			if (
				(url.protocol !== "http:" && url.protocol !== "https:") ||
				url.origin !== base.origin
			)
				continue;

			url.hash = "";
			traversableLinks.add(url.toString());
		}

		return [...traversableLinks];
	}

	private delegateStrategy(
		contentTypeHeader: FetchResult["contentType"],
	): ParserStrategy | undefined {
		if (!contentTypeHeader) return undefined;
		return this.parserStrategies.find((strategy) =>
			strategy.supports(contentTypeHeader.toString()),
		);
	}
}
