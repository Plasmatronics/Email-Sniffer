import {
	EmailPattern,
	generateEmailLocalPartMap,
	KnownEmailPattern,
} from "../../shared";
import { extractDomain } from "../../utils";
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
			const normalizedCompanyUrl = extractDomain(emailInfo.companyUrl);
			if (!normalizedCompanyUrl) throw new Error("Could not verify companyUrl");

			const companyUrlDomainResults = await this.getDerivedDomainInformation(
				emailInfo.companyUrl,
			);

			const companyWebsiteEmailEvidence =
				await this.dependencies.companyWebsiteEmailEvidenceCollector.collect({
					companyUrl: emailInfo.companyUrl,
				});

			const prePdfSearchAggregation =
				await this.dependencies.domainResultAndPatternAggregator.aggregateEvidence(
					[...companyWebsiteEmailEvidence],
				);
			if (
				prePdfSearchAggregation.domainResults.some(
					(res: DomainResults) => res.domain === companyUrlDomainResults.domain,
				)
			)
				prePdfSearchAggregation.domainResults.find(
					(res) => res.domain === companyUrlDomainResults.domain,
				)!.count++;
			else prePdfSearchAggregation.domainResults.push(companyUrlDomainResults);

			const pdfSearchEmailEvidence =
				await this.dependencies.pdfEmailEvidenceCollector.collect({
					companyUrl: normalizedCompanyUrl,
					topChoiceDomain: prePdfSearchAggregation.domainResults.length
						? prePdfSearchAggregation.domainResults.sort((a, b) => {
								const confidenceDiff = b.confidence - a.confidence;
								if (confidenceDiff) return confidenceDiff;

								return b.count - a.count;
							})[0].domain
						: undefined,
				});

			const aggregatedResults =
				this.dependencies.domainResultAndPatternAggregator.aggregateResults([
					prePdfSearchAggregation,
					await this.dependencies.domainResultAndPatternAggregator.aggregateEvidence(
						pdfSearchEmailEvidence,
					),
				]);

			await this.checkCatchAlls(aggregatedResults.domainResults);

			const { topDomains, topPatterns } = this.getTopDomainsAndPatterns(
				aggregatedResults.domainResults,
				aggregatedResults.patternFreq,
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
