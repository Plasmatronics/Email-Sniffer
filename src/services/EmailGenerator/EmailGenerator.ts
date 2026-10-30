import {
	EmailPattern,
	generateEmailLocalPartMap,
	KnownEmailPattern,
} from "../../shared";
import { extractDomain } from "../../utils";
import {
	DomainResults,
	EmailGeneratorDependencies,
	EmailInferenceResults,
	EmailGeneratorOptions,
	SearchInformation,
	EmailInferenceCandidate,
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
			const normalizedCompanyDomain = extractDomain(emailInfo.companyUrl);
			if (!normalizedCompanyDomain)
				throw new Error("companyUrl is not syntatically correct.");

			const companyUrlDomainResults = await this.getDerivedDomainInformation(
				emailInfo.companyUrl,
			);
			const companyWebsiteEmailEvidence =
				await this.dependencies.companyWebsiteEmailEvidenceCollector.collect({
					companyUrl: emailInfo.companyUrl,
				});
			const companyWebsiteAggregation =
				await this.dependencies.domainResultAndPatternAggregator.aggregateEvidence(
					[...companyWebsiteEmailEvidence],
				);

			const pdfSearchEmailEvidence =
				await this.dependencies.pdfEmailEvidenceCollector.collect({
					companyUrl: normalizedCompanyDomain,
					topChoiceDomain: companyWebsiteAggregation.domainResults.length
						? companyWebsiteAggregation.domainResults.sort((a, b) => {
								const confidenceDiff = b.confidence - a.confidence;
								if (confidenceDiff) return confidenceDiff;

								return b.count - a.count;
							})[0].domain
						: undefined,
				});

			const aggregatedResults =
				this.dependencies.domainResultAndPatternAggregator.aggregateResults([
					{
						domainResults: [companyUrlDomainResults],
						patternFreq: new Map<KnownEmailPattern, number>(),
					},
					companyWebsiteAggregation,
					await this.dependencies.domainResultAndPatternAggregator.aggregateEvidence(
						pdfSearchEmailEvidence,
					),
				]);

			await this.enrichCheckAllStatus(aggregatedResults.domainResults);

			const { topDomains, topPatterns } = this.getTopDomainsAndPatterns(
				aggregatedResults.domainResults,
				aggregatedResults.patternFreq,
			);

			const candidates = await this.getInferenceCandidates(
				topDomains,
				topPatterns,
				emailInfo.firstName,
				emailInfo.lastName,
			);

			const scoredCandidates: EmailInferenceResults[] =
				this.dependencies.inferredEmailConfidenceScorer.scoreCandidates(
					candidates,
					aggregatedResults.patternFreq,
				);

			const successCandidates = scoredCandidates.filter((res) => res.success);
			if (!scoredCandidates.length)
				throw new Error("No suitable candidates found");

			return successCandidates.sort((a, b) => b.confidence - a.confidence)[0];
		} catch (err: unknown) {
			return {
				success: false,
				reason: `${err instanceof Error ? err.message : "An unknown error has occurred"}`,
			};
		}
	}

	private async getDerivedDomainInformation(
		companyUrl: string,
	): Promise<DomainResults> {
		const domain = extractDomain(companyUrl);
		let mxRecords: string[] = [];

		const domainResultsOverlap: Partial<DomainResults> = {
			catchAll: "unknown",
			count: 1,
			domain,
		};

		try {
			mxRecords =
				await this.dependencies.mxRecordRetriever.findMXRecords(domain);

			return {
				...domainResultsOverlap,
				mxRecords,
				confidence: this.dependencies.domainConfidenceScorer.validateDomain(
					companyUrl,
					domain,
					companyUrl,
				).confidence,
			} as DomainResults;
		} catch (err: unknown) {
			console.error(
				`Failed to retrieve MX records for domain ${domain}: ${
					err instanceof Error ? err.message : "unknown error"
				}`,
			);

			return {
				...domainResultsOverlap,
				mxRecords,
				confidence: 0,
			} as DomainResults;
		}
	}

	private async enrichCheckAllStatus(domains: DomainResults[]): Promise<void> {
		await Promise.all(
			domains.map(async (domain) => {
				const smtpVerification = await this.dependencies.smtpVerifier.verify(
					`${this.options.catchAllEmailLocalPart}@${domain.domain}`,
					domain.mxRecords,
				);

				if (smtpVerification.status === "accepted")
					domain.catchAll = "catch-all";
				else if (smtpVerification.status === "rejected")
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

	private async getInferenceCandidates(
		topDomains: DomainResults[],
		topPatterns: EmailPattern[],
		firstName: string,
		lastName: string,
	): Promise<EmailInferenceCandidate[]> {
		if (!topDomains.length) return [];

		const smtpRes = await Promise.allSettled(
			topDomains.flatMap((domain) =>
				topPatterns.map(async (pattern): Promise<EmailInferenceCandidate> => {
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
						catchAll: domain.catchAll,
						domainConfidence: domain.confidence,
						smtpVerificationResult: await this.dependencies.smtpVerifier.verify(
							email,
							domain.mxRecords,
						),
						pattern,
						email,
					};
				}),
			),
		);

		const successfulRequests = smtpRes.filter(
			(res) => res.status === "fulfilled",
		);
		if (!successfulRequests.length) {
			const errorReasons = smtpRes
				.filter((res) => res.status === "rejected")
				.map((res) => res.reason);

			console.warn(
				`No SMTP promises were fulfilled. Reasons: ${
					errorReasons.length ? errorReasons.join("\n") : "N/A"
				}`,
			);
		}

		return successfulRequests.map((res) => res.value);
	}
}
