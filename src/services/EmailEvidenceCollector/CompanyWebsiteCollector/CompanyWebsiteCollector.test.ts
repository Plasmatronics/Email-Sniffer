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
import { WebsiteEmailCrawler } from "../../WebsiteEmailCrawler";
import { CompanyWebsiteCollector } from "./CompanyWebsiteCollector";

const COMPANY_URL = "https://example.com";
const SOURCE_URL = "https://example.com/contact";

function createCollector() {
	const websiteCrawler = new WebsiteEmailCrawler(
		[],
		new EmailExtractor(new TextChunker(), new DocumentClamper()),
		new EmailPatternInferrer(new TextChunker()),
	);
	const domainConfidenceScorer = new DomainConfidenceScorer();
	const crawl = vi.spyOn(websiteCrawler, "crawl");
	const validateDomain = vi.spyOn(domainConfidenceScorer, "validateDomain");

	return {
		collector: new CompanyWebsiteCollector(
			{
				websiteCrawler,
				domainConfidenceScorer,
			},
			{ numPagesToCrawl: 3 },
		),
		crawl,
		validateDomain,
	};
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

describe("CompanyWebsiteCollector", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	test("collects passing evidence and uses the configured crawl limit", async () => {
		const { collector, crawl, validateDomain } = createCollector();
		const inferredResults: PatternInference[] = [
			{
				email: "alice@example.com",
				pattern: EmailPattern.FirstNameDotLastName,
			},
			{ email: "privacy@external.com", pattern: EmailPattern.Unknown },
		];
		crawl.mockResolvedValue({ [SOURCE_URL]: inferredResults });
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
				pattern: EmailPattern.FirstNameDotLastName,
				source: SOURCE_URL,
				domainConfidence: 100,
			},
		]);

		expect(crawl).toHaveBeenCalledWith("example.com", { maxPages: 3 });
		expect(validateDomain).toHaveBeenCalledWith(
			SOURCE_URL,
			"example.com",
			"example.com",
		);
	});

	test("returns no evidence when the crawler returns no pages", async () => {
		const { collector, crawl, validateDomain } = createCollector();
		crawl.mockResolvedValue({});

		await expect(
			collector.collect({ companyUrl: COMPANY_URL }),
		).resolves.toEqual([]);

		expect(validateDomain).not.toHaveBeenCalled();
	});

	test("returns no evidence and reports a malformed company URL", async () => {
		const { collector, crawl, validateDomain } = createCollector();
		const error = vi.spyOn(console, "error").mockImplementation(() => {});

		await expect(
			collector.collect({ companyUrl: "not a company url" }),
		).resolves.toEqual([]);

		expect(error).toHaveBeenCalledWith(
			'Unable to collect any website search results for company "not a company url" due to malformed input',
		);
		expect(crawl).not.toHaveBeenCalled();
		expect(validateDomain).not.toHaveBeenCalled();
	});
});
