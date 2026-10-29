import { extractDomain } from "../../../utils";
import {
	DomainConfidenceScorer,
	VerificationResult,
} from "../../DomainConfidenceScorer";
import { WebSearcher } from "../../WebSearcher";
import { WebsiteEmailCrawler } from "../../WebsiteEmailCrawler";
import {
	EmailEvidenceCollector,
	EmailEvidence,
} from "../EmailEvidenceCollector";

export interface PdfCollectionInput {
	companyUrl: string;
	topChoiceDomain?: string;
}

export interface PdfCollectionDependencies {
	websiteCrawler: WebsiteEmailCrawler;
	domainConfidenceScorer: DomainConfidenceScorer;
	webSearcher: WebSearcher;
}

export class PdfSearchCollector extends EmailEvidenceCollector<
	PdfCollectionInput,
	PdfCollectionDependencies
> {
	constructor(dependencies: PdfCollectionDependencies) {
		super(dependencies);
	}

	async collect(input: PdfCollectionInput): Promise<EmailEvidence[]> {
		const { topChoiceDomain, companyUrl } = input;
		const normalizedCompanyUrl = extractDomain(companyUrl);
		const normalizedTopChoiceDomain = extractDomain(topChoiceDomain ?? "");

		if (!normalizedCompanyUrl || !normalizedTopChoiceDomain) {
			if (topChoiceDomain && !normalizedTopChoiceDomain)
				console.warn(
					`Unable to collect comprehensive pdf search results for domain "${topChoiceDomain}" at company "${companyUrl}" due to malformed input`,
				);

			if (!normalizedCompanyUrl) {
				console.error(
					`Unable to collect any pdf search results for company "${companyUrl}" due to malformed input`,
				);

				return [];
			}
		}

		const searchResults = await this.dependencies.webSearcher.fetchResults(
			normalizedTopChoiceDomain
				? `@${normalizedTopChoiceDomain}`
				: normalizedCompanyUrl,
		);

		const pdfScrapingRes = await Promise.allSettled(
			searchResults.map(async (res) => {
				const urlToInferenceMap = await this.dependencies.websiteCrawler.crawl(
					res.link,
					{
						maxPages: 1,
					},
				);

				const emailEvidenceArr: EmailEvidence[] = [];

				for (const { email, pattern } of urlToInferenceMap[res.link]) {
					const domain = extractDomain(email);

					const validationResults =
						this.dependencies.domainConfidenceScorer.validateDomain(
							res.link,
							domain,
							normalizedCompanyUrl,
						);
					if (validationResults.verificationResult !== VerificationResult.Pass)
						continue;

					emailEvidenceArr.push({
						email,
						pattern,
						source: res.link,
						domainConfidence: validationResults.confidence,
					});
				}

				return emailEvidenceArr;
			}),
		);

		const errors = pdfScrapingRes
			.filter((res) => res.status === "rejected")
			.map((res) => res.reason)
			.join("\n");
		if (errors.length) console.error(errors);

		return pdfScrapingRes.flatMap((res) =>
			res.status === "fulfilled" ? res.value : [],
		);
	}
}
