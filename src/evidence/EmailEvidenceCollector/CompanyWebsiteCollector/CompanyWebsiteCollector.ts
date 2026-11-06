import { extractDomain } from "../../../utils";
import {
	DomainConfidenceScorer,
	VerificationResult,
} from "../../../domain/DomainConfidenceScorer";
import { WebsiteEmailCrawler } from "../../../crawling/WebsiteEmailCrawler";
import {
	EmailEvidenceCollector,
	EmailEvidence,
} from "../EmailEvidenceCollector";
import { DEFAULT_WEBSITE_FETCHER_CONFIG } from "../../../crawling";

export interface CompanyWebsiteCollectionInput {
	companyUrl: string;
}
export interface CompanyWebsiteCollectionDependencies {
	websiteCrawler: WebsiteEmailCrawler;
	domainConfidenceScorer: DomainConfidenceScorer;
}
export interface CompanyWebsiteCollectionConfig {
	numPagesToCrawl: number;
}

export class CompanyWebsiteCollector extends EmailEvidenceCollector<
	CompanyWebsiteCollectionInput,
	CompanyWebsiteCollectionDependencies,
	CompanyWebsiteCollectionConfig
> {
	constructor(
		dependencies: CompanyWebsiteCollectionDependencies,
		config: CompanyWebsiteCollectionConfig,
	) {
		super(dependencies, config);
	}

	async collect(
		input: CompanyWebsiteCollectionInput,
	): Promise<EmailEvidence[]> {
		const { companyUrl } = input;
		const normalizedCompanyUrl = extractDomain(companyUrl);
		if (!normalizedCompanyUrl) {
			console.error(
				`Unable to collect any website search results for company "${companyUrl}" due to malformed input`,
			);

			return [];
		}

		const crawlResultsMap = await this.dependencies.websiteCrawler.crawl(
			companyUrl,
			{
				maxPages: this.config!.numPagesToCrawl,
				...DEFAULT_WEBSITE_FETCHER_CONFIG,
			},
		);

		const emailEvidenceArr: EmailEvidence[] = [];
		for (const [sourceUrl, emailAndInferredPatternArr] of Object.entries(
			crawlResultsMap,
		)) {
			for (const { email, pattern } of emailAndInferredPatternArr) {
				const domain = extractDomain(email);

				const validationResults =
					this.dependencies.domainConfidenceScorer.validateDomain(
						sourceUrl,
						domain,
						normalizedCompanyUrl,
					);
				if (validationResults.verificationResult !== VerificationResult.Pass)
					continue;

				emailEvidenceArr.push({
					email,
					pattern,
					source: sourceUrl,
					domainConfidence: validationResults.confidence,
				});
			}
		}

		return emailEvidenceArr;
	}
}
