import { afterEach, describe, expect, test, vi } from "vitest";
import { EmailPattern, type PatternInference } from "../../../shared";
import {
	DomainConfidenceScorer,
	VerificationResult,
} from "../../DomainConfidenceScorer";
import { DocumentClamper } from "../../DocumentClamper";
import { EmailExtractor } from "../../EmailExtractor";
import { EmailPatternInferrer } from "../../EmailPatternInferrer";
import { TextChunker } from "../../TextChunker";
import { WebSearcher } from "../../WebSearcher";
import { WebsiteEmailCrawler } from "../../WebsiteEmailCrawler";
import type { WebSearchClient } from "../../../integrations";
import type { WebSearchResult } from "../../../types";
import { PdfSearchCollector } from "./PdfSearchCollector";
import { extractDomain } from "../../../utils";

const COMPANY_URL = "https://example.com";
const SEARCH_URL = "https://example.com/report.pdf";

const searchResult: WebSearchResult = {
	title: "Example report",
	link: SEARCH_URL,
	position: 1,
};

function createCollector() {
	const webSearchClient: WebSearchClient = { search: vi.fn() };
	const webSearcher = new WebSearcher(webSearchClient);
	const websiteCrawler = new WebsiteEmailCrawler(
		[],
		new EmailExtractor(new TextChunker(), new DocumentClamper()),
		new EmailPatternInferrer(new TextChunker()),
	);
	const domainConfidenceScorer = new DomainConfidenceScorer();

	const fetchResults = vi.spyOn(webSearcher, "fetchResults");
	const crawl = vi.spyOn(websiteCrawler, "crawl");
	const validateDomain = vi.spyOn(domainConfidenceScorer, "validateDomain");

	return {
		collector: new PdfSearchCollector({
			webSearcher,
			websiteCrawler,
			domainConfidenceScorer,
		}),

		fetchResults,
		crawl,
		validateDomain,
	};
}

function passingInference(email = "alice@example.com"): PatternInference[] {
	return [{ email, pattern: EmailPattern.FirstName }];
}

function passValidation(domain: string) {
	return {
		confidence: 100,
		domain,
		verificationResult: VerificationResult.Pass,
	};
}

function failValidation(domain: string) {
	return {
		confidence: 0,
		domain,
		verificationResult: VerificationResult.Fail,
	};
}

describe("PdfSearchCollector", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	test("collects passing evidence from each search result", async () => {
		const { collector, fetchResults, crawl, validateDomain } =
			createCollector();
		fetchResults.mockResolvedValue([searchResult]);
		crawl.mockResolvedValue({ [SEARCH_URL]: passingInference() });
		validateDomain.mockReturnValue(passValidation("example.com"));

		await expect(
			collector.collect({
				companyUrl: COMPANY_URL,
				topChoiceDomain: "example.com",
			}),
		).resolves.toEqual([
			{
				email: "alice@example.com",
				pattern: EmailPattern.FirstName,
				source: SEARCH_URL,
				domainConfidence: 100,
			},
		]);

		expect(fetchResults).toHaveBeenCalledWith("@example.com");
		expect(crawl).toHaveBeenCalledWith(SEARCH_URL, { maxPages: 1 });
		expect(validateDomain).toHaveBeenCalledWith(
			SEARCH_URL,
			"example.com",
			extractDomain(COMPANY_URL),
		);
	});

	test("returns an empty list when search returns no results", async () => {
		const { collector, fetchResults, crawl } = createCollector();
		fetchResults.mockResolvedValue([]);

		await expect(
			collector.collect({ companyUrl: COMPANY_URL }),
		).resolves.toEqual([]);

		expect(crawl).not.toHaveBeenCalled();
	});

	test("returns no results and reports when both input domains are malformed", async () => {
		const { collector, fetchResults } = createCollector();
		const error = vi.spyOn(console, "error").mockImplementation(() => {});

		await expect(
			collector.collect({
				companyUrl: "not a company url",
				topChoiceDomain: "not a domain",
			}),
		).resolves.toEqual([]);

		expect(error).toHaveBeenCalledWith(
			'Unable to collect any pdf search results for company "not a company url" due to malformed input',
		);
		expect(fetchResults).not.toHaveBeenCalled();
	});

	test("reports a malformed top-choice domain and falls back to the company domain", async () => {
		const { collector, fetchResults } = createCollector();
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		fetchResults.mockResolvedValue([]);

		await expect(
			collector.collect({
				companyUrl: COMPANY_URL,
				topChoiceDomain: "not a domain",
			}),
		).resolves.toEqual([]);

		expect(warn).toHaveBeenCalledWith(
			'Unable to collect comprehensive pdf search results for domain "not a domain" at company "https://example.com" due to malformed input',
		);
		expect(fetchResults).toHaveBeenCalledWith("example.com");
	});

	test("keeps successful evidence when another result fails", async () => {
		const { collector, fetchResults, crawl, validateDomain } =
			createCollector();
		const failedUrl = "https://example.com/broken.pdf";
		fetchResults.mockResolvedValue([
			searchResult,
			{ ...searchResult, link: failedUrl, position: 2 },
		]);
		crawl
			.mockResolvedValueOnce({ [SEARCH_URL]: passingInference() })
			.mockRejectedValueOnce(new Error("crawl failed"));
		validateDomain.mockReturnValue(passValidation("example.com"));
		vi.spyOn(console, "error").mockImplementation(() => {});

		await expect(
			collector.collect({ companyUrl: COMPANY_URL }),
		).resolves.toEqual([
			{
				email: "alice@example.com",
				pattern: EmailPattern.FirstName,
				source: SEARCH_URL,
				domainConfidence: 100,
			},
		]);

		expect(console.error).toHaveBeenCalledWith("Error: crawl failed");
	});

	test("continues after a non-passing email and collects later passing emails", async () => {
		const { collector, fetchResults, crawl, validateDomain } =
			createCollector();
		const inferredResults: PatternInference[] = [
			{ email: "invalid@external.com", pattern: EmailPattern.Unknown },
			{
				email: "alice@example.com",
				pattern: EmailPattern.FirstName,
			},
		];
		fetchResults.mockResolvedValue([searchResult]);
		crawl.mockResolvedValue({ [SEARCH_URL]: inferredResults });
		validateDomain.mockImplementation((_source, domain) =>
			domain === "example.com"
				? passValidation(domain)
				: failValidation(domain),
		);

		await expect(
			collector.collect({ companyUrl: COMPANY_URL }),
		).resolves.toEqual([
			{
				email: "alice@example.com",
				pattern: EmailPattern.FirstName,
				source: SEARCH_URL,
				domainConfidence: 100,
			},
		]);
	});
});
