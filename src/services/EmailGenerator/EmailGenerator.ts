import {
	EmailPattern,
	generateEmailLocalPartMap,
	KnownEmailPattern,
} from "../../shared";
import { extractDomain } from "../../utils";
import { VerificationResult } from "../DomainConfidenceScorer";
import { SMTPVerificationResult } from "../SMTPVerifier";
import {
	DomainResults,
	EmailGeneratorDependencies,
	EmailInferenceResults,
	EmailGeneratorOptions,
	SearchInformation,
} from "./EmailGenerator.types";

export class EmailGenerator {
	constructor(
		private readonly dependencies: EmailGeneratorDependencies,
		private readonly options: EmailGeneratorOptions,
	) {}

	async inferEmail(
		emailInfo: SearchInformation,
	): Promise<EmailInferenceResults> {
		try {
			const patternCount = new Map<KnownEmailPattern, number>(
				Object.values(EmailPattern)
					.filter((pattern) => pattern !== EmailPattern.Unknown)
					.map((pattern) => [pattern, 0]),
			);
			const domainResultsMap = new Map<string, DomainResults>();

			await this.getDerivedDomainInformation(
				emailInfo.companyUrl,
				domainResultsMap,
			);

			await this.getHomepageDomainAndPatternResults(
				emailInfo.companyUrl,
				domainResultsMap,
				patternCount,
			);

			await this.getCrawledPdfResults(
				domainResultsMap,
				patternCount,
				emailInfo.companyUrl,
			);

			const domains = [...domainResultsMap.values()];

			await this.checkCatchAlls(domains);

			const { topDomains, topPatterns } = this.getTopDomainsAndPatterns(
				domains,
				patternCount,
			);

			const topInferenceCandidate = await this.getBestInferenceCandidate(
				topDomains,
				topPatterns,
				emailInfo.firstName,
				emailInfo.lastName,
			);

			return this.normalizeCandidateData(topInferenceCandidate);
		} catch (err: unknown) {
			return {
				success: false,
				reason: `${err instanceof Error ? err.message : "An unknown error has occurred"}`,
			};
		}
	}

	private async getDerivedDomainInformation(
		companyUrl: string,
		domainResultsMap: Map<string, DomainResults>,
	): Promise<void> {
		const domain = extractDomain(companyUrl);
		if (this.incrementDomainCountIfSeen(domain, domainResultsMap)) return;

		try {
			const mxRecords =
				await this.dependencies.mxRecordRetriever.findMXRecords(domain);
			if (!mxRecords.length) return;

			const domainResult: DomainResults = {
				mxRecords,
				domain,
				confidence: this.dependencies.domainConfidenceScorer.validateDomain(
					companyUrl,
					domain,
					companyUrl,
				).confidence,
				catchAll: "unknown",
				count: 1,
			};
			domainResultsMap.set(domain, domainResult);
		} catch (err: unknown) {
			console.error(
				`Failed to retrieve MX records for domain ${domain}: ${
					err instanceof Error ? err.message : "unknown error"
				}`,
			);

			return;
		}
	}

	private async getHomepageDomainAndPatternResults(
		companyUrl: string,
		domainResultsMap: Map<string, DomainResults>,
		patternMap: Map<EmailPattern, number>,
	): Promise<void> {
		const crawlResultsMap = await this.dependencies.websiteEmailCrawler.crawl(
			companyUrl,
			{
				maxPages: this.options.companyUrlPagesSearchNum,
			},
		);

		const mxLookupPromises = new Map<string, Promise<string[]>>();
		for (const [sourceUrl, emailAndInferredPatternArr] of Object.entries(
			crawlResultsMap,
		)) {
			const processingAndMxLookupRes = await Promise.allSettled(
				emailAndInferredPatternArr.map(async (emailAndPattern) => {
					const domain = extractDomain(emailAndPattern.email);

					const validationResults =
						this.dependencies.domainConfidenceScorer.validateDomain(
							sourceUrl,
							domain,
							companyUrl,
						);
					if (validationResults.verificationResult !== VerificationResult.Pass)
						return null;

					if (emailAndPattern.pattern !== EmailPattern.Unknown) {
						patternMap.set(
							emailAndPattern.pattern,
							(patternMap.get(emailAndPattern.pattern) ?? 0) + 1,
						);
					}

					if (this.incrementDomainCountIfSeen(domain, domainResultsMap))
						return null;

					const mxRecords = await this.getMxRecords(
						emailAndPattern.email,
						mxLookupPromises,
					);
					if (!mxRecords.length) return null;

					if (this.incrementDomainCountIfSeen(domain, domainResultsMap))
						return null;

					const domainResult: DomainResults = {
						mxRecords,
						domain: domain,
						confidence: validationResults.confidence,
						catchAll: "unknown",
						count: 1,
					};
					domainResultsMap.set(domain, domainResult);
					return null;
				}),
			);

			const failedReasons = processingAndMxLookupRes
				.filter((res) => res.status === "rejected")
				.map((res) => res.reason);
			if (failedReasons.length)
				console.warn(
					`Not all homepage email and domain processing was successful: ${failedReasons.join("\n")}`,
				);
		}
	}

	private async getCrawledPdfResults(
		domainResultsMap: Map<string, DomainResults>,
		patternMap: Map<EmailPattern, number>,
		companyUrl: string,
		topChoiceDomain?: string,
	): Promise<void> {
		try {
			const searchResults = await this.dependencies.webSearcher.fetchResults(
				topChoiceDomain ? `@${topChoiceDomain}` : extractDomain(companyUrl),
			);

			const mxLookupPromises = new Map<string, Promise<string[]>>();

			const processingAndMxLookupRes = await Promise.allSettled(
				searchResults.map(async (res) => {
					const urlToInferenceMap =
						await this.dependencies.websiteEmailCrawler.crawl(res.link, {
							maxPages: 1,
						});

					for (const { email, pattern } of urlToInferenceMap[res.link]) {
						const domain = extractDomain(email);

						const validationResults =
							this.dependencies.domainConfidenceScorer.validateDomain(
								res.link,
								domain,
								companyUrl,
							);
						if (
							validationResults.verificationResult !== VerificationResult.Pass
						)
							return null;

						if (pattern !== EmailPattern.Unknown)
							patternMap.set(pattern, (patternMap.get(pattern) ?? 0) + 1);

						if (this.incrementDomainCountIfSeen(domain, domainResultsMap))
							return;

						const mxRecords = await this.getMxRecords(email, mxLookupPromises);
						if (!mxRecords.length) return;

						if (this.incrementDomainCountIfSeen(domain, domainResultsMap))
							return;

						const domainResult: DomainResults = {
							mxRecords,
							domain: domain,
							confidence: validationResults.confidence,
							catchAll: "unknown",
							count: 1,
						};
						domainResultsMap.set(domain, domainResult);
					}
				}),
			);

			const failures = processingAndMxLookupRes
				.filter((res) => res.status === "rejected")
				.map((res) => res.reason);
			if (failures.length) throw new Error(failures.join("\n"));
		} catch (err: unknown) {
			console.warn(
				`Pdf Result Crawling was not entirely successful: ${err instanceof Error ? err.message : "An unknown error occurred"}`,
			);

			return;
		}
	}

	private async checkCatchAlls(domains: DomainResults[]): Promise<void> {
		await Promise.all(
			domains.map(async (domain) => {
				const smtpVerification = await this.dependencies.smtpVerifier.verify(
					`${this.options.catchAllEmailLocalPart}@${domain.domain}`,
					domain.mxRecords,
				);

				if (smtpVerification.status === "accepted") {
					domain.confidence = Math.max(
						0,
						domain.confidence - this.options.catchAllConfidencePenalty,
					);
					domain.catchAll = "catch-all";
				} else if (smtpVerification.status === "rejected")
					domain.catchAll = "not-catch-all";
				else domain.catchAll = "unknown";
			}),
		);
	}

	private getTopDomainsAndPatterns(
		domains: DomainResults[],
		patternMap: Map<EmailPattern, number>,
	): { topDomains: DomainResults[]; topPatterns: EmailPattern[] } {
		return {
			topPatterns: patternMap
				.entries()
				.toArray()
				.sort((a, b) => b[1] - a[1])
				.map(([pattern]) => pattern)
				.slice(0, this.options.numPatternsToVerify),

			topDomains: domains
				.sort((a, b) => {
					const confidenceDiff = b.confidence - a.confidence;
					return confidenceDiff ? confidenceDiff : b.count - a.count;
				})
				.slice(0, this.options.numDomainsToVerify),
		};
	}

	private async getBestInferenceCandidate(
		topDomains: DomainResults[],
		topPatterns: EmailPattern[],
		firstName: string,
		lastName: string,
	): Promise<{
		email: string;
		pattern: EmailPattern;
		domain: DomainResults;
		verification: SMTPVerificationResult;
	}> {
		const smtpRes = await Promise.allSettled(
			topDomains.flatMap((domain) =>
				topPatterns.map(async (pattern) => {
					if (pattern === EmailPattern.Unknown)
						throw new Error(
							"Could not complete verfication for this email as it is based off of an unknown pattern",
						);

					const emailLocalPart = generateEmailLocalPartMap[pattern](
						firstName,
						lastName,
					);
					const email = `${emailLocalPart}@${domain.domain}`;

					return {
						email,
						pattern,
						domain,
						verification: await this.dependencies.smtpVerifier.verify(
							email,
							domain.mxRecords,
						),
					};
				}),
			),
		);

		const successSmtp = smtpRes
			.filter((smtp) => smtp.status === "fulfilled")
			.map((res) => res.value);
		if (!successSmtp.length) {
			const rejectionReasons = smtpRes
				.filter((res) => res.status === "rejected")
				.map((res) => res.reason);
			throw new Error(
				`No SMTP promises were fulfilled. Reasons: ${
					rejectionReasons.length ? rejectionReasons.join("; ") : "N/A"
				}`,
			);
		}

		const acceptedSMTPResponses = successSmtp.filter(
			(res) => res.verification.status === "accepted",
		);
		if (!acceptedSMTPResponses.length) {
			const nonAcceptedDetails = successSmtp
				.filter((res) => res.verification.status !== "accepted")
				.map((res) => `${res.email}: ${res.verification.message}`);
			throw new Error(
				`No SMTP requests were accepted. Details: ${
					nonAcceptedDetails.length
						? nonAcceptedDetails.join("; ")
						: "All SMTP verifications failed or were rejected."
				}`,
			);
		}

		return acceptedSMTPResponses.sort(
			(a, b) => b.domain.confidence - a.domain.confidence,
		)[0];
	}

	private getMxRecords(
		email: string,
		mxLookups: Map<string, Promise<string[]>>,
	): Promise<string[]> {
		const domain = extractDomain(email);
		const existingLookup = mxLookups.get(domain);
		if (existingLookup) return existingLookup;

		const lookup = this.dependencies.mxRecordRetriever
			.findMXRecords(email)
			.finally(() => {
				if (mxLookups.get(domain) === lookup) {
					mxLookups.delete(domain);
				}
			});

		mxLookups.set(domain, lookup);
		return lookup;
	}

	private incrementDomainCountIfSeen(
		domain: string,
		domainResultsMap: Map<string, DomainResults>,
	): boolean {
		const existingDomain = domainResultsMap.get(domain);
		if (!existingDomain) return false;

		existingDomain.count++;
		return true;
	}

	private normalizeCandidateData(rawCandidateData: {
		email: string;
		pattern: EmailPattern;
		domain: DomainResults;
		verification: SMTPVerificationResult;
	}): EmailInferenceResults {
		return {
			success: true,
			confidence: rawCandidateData.domain.confidence,
			catchAll: rawCandidateData.domain.catchAll,
			pattern: rawCandidateData.pattern,
			inferredEmail: rawCandidateData.email,
		};
	}
}
