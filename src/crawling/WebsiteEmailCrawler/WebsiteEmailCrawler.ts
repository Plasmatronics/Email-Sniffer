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
import { logger } from "../../infrastructure";

export const MAX_ALLOWED_PAGE_ATTEMPTS = 50;
const MAX_ALLOWED_PAGES = 20;
const MIN_ALLOWED_PAGES = 1;
const MAX_CONTENT_LENGTH = 10_000_000;

export interface WebsiteEmailCrawlerConfig extends WebsiteFetcherConfig {
	maxPages: number;
}

export type CrawlResult = Record<string, PatternInference[]>;

export class WebsiteEmailCrawler {
	private readonly serviceName = "WebsiteEmailCrawler";

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
		const childLogger = logger.child({
			serviceName: this.serviceName,
			crawlUrl: url,
		});

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
				childLogger.debug({ pageUrl: poppedUrl }, "Fetching URL");
				res = await this.websiteFetcher.fetch(poppedUrl, fetcherConfig);
			} catch (error) {
				childLogger.warn(
					{ err: error, pageUrl: poppedUrl },
					"Failed to fetch page",
				);

				continue;
			}

			const strategy = this.delegateStrategy(res.contentType ?? "");
			if (!strategy) {
				childLogger.warn(
					{ pageUrl: poppedUrl, contentType: res.contentType },
					"No applicable parser found for content type",
				);

				continue;
			}

			let links: string[];
			let text: string;
			try {
				childLogger.debug({ pageUrl: poppedUrl }, "Parsing data");
				const strategyRes = await strategy.parse(res.data);
				links = strategyRes.links;
				text = strategyRes.text;
			} catch (err: unknown) {
				childLogger.warn(
					{ err, pageUrl: poppedUrl },
					"Error during content parsing",
				);

				continue;
			}

			const traversableLinks = this.getTraversableLinks(links, poppedUrl);
			childLogger.debug(
				{
					pageUrl: poppedUrl,
					linksFound: links.length,
					traversableLinks: traversableLinks.length,
				},
				"Page links extracted",
			);

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
					childLogger.warn(
						{ err, pageUrl: poppedUrl },
						"Error during page weight retrieval",
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
