import { EmailPattern, generateEmailLocalPartMap } from "../../shared";
import { extractDomain } from "../../utils";
import { VerificationResult } from "../CompanyDomainValidator";
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
			const { fromEmail } = this.options;

			const patternCount = new Map<EmailPattern, number>(
				Object.values(EmailPattern).map((pattern) => [pattern, 0]),
			);
			const domains: DomainResults[] = [];
			const seenDomains = new Set<string>();

			const domainDerivedData = await this.getDerivedDomainInformation(
				emailInfo.companyUrl,
				seenDomains,
			);
			if (domainDerivedData) domains.push(domainDerivedData);

			const crawledDomainInformationResults =
				await this.getCrawledDomainInformationResults(
					emailInfo.companyUrl,
					seenDomains,
					patternCount,
				);
			if (crawledDomainInformationResults.length)
				domains.push(...crawledDomainInformationResults);

			await this.checkCatchAlls(domains, fromEmail);

			const { topDomains, topPatterns } = this.getTopDomainsAndPatterns(
				domains,
				patternCount,
			);

			const topInferenceCandidate = await this.getBestInferenceCandidate(
				topDomains,
				topPatterns,
				emailInfo.firstName,
				emailInfo.lastName,
				fromEmail,
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
		seenDomains: Set<string>,
	): Promise<DomainResults | null> {
		const domain = extractDomain(companyUrl);

		try {
			const mxRecords =
				await this.dependencies.mxRecordRetriever.findMXRecords(domain);
			if (!mxRecords.length) return null;

			seenDomains.add(domain);

			return {
				mxRecords,
				domain,
				confidence: this.dependencies.domainValidator.validateDomain(
					companyUrl,
					domain,
					companyUrl,
				).confidence,
				catchAll: "unknown",
			};
		} catch {
			// Continue pipeline, even if direct domain info extraction fails
			return null;
		}
	}

	private async getCrawledDomainInformationResults(
		companyUrl: string,
		seenDomains: Set<string>,
		patternMap: Map<EmailPattern, number>,
	): Promise<DomainResults[]> {
		const crawlResultsMap = await this.dependencies.websiteEmailCrawler.crawl(
			companyUrl,
			{
				maxPages: this.options.maxPages,
			},
		);

		const mxLookupPromises = new Map<string, Promise<string[]>>();
		const domainInformationArr: DomainResults[] = [];

		for (const [sourceUrl, emailAndInferredPatternArr] of Object.entries(
			crawlResultsMap,
		)) {
			const results = await Promise.allSettled(
				emailAndInferredPatternArr.map(async (emailAndPattern) => {
					const domain = extractDomain(emailAndPattern.email);

					const validationResults =
						this.dependencies.domainValidator.validateDomain(
							sourceUrl,
							domain,
							companyUrl,
						);
					if (validationResults.verificationResult !== VerificationResult.Pass)
						return null;

					patternMap.set(
						emailAndPattern.pattern,
						(patternMap.get(emailAndPattern.pattern) ?? 0) + 1,
					);

					if (seenDomains.has(domain)) return null;

					const mxRecords = await this.getMxRecords(
						emailAndPattern.email,
						mxLookupPromises,
					);

					if (seenDomains.has(domain)) return null;
					seenDomains.add(domain);

					return {
						mxRecords,
						domain: domain,
						confidence: validationResults.confidence,
						catchAll: "unknown",
					};
				}),
			);

			const fulfilledRes = results
				.filter((res) => res.status === "fulfilled")
				.map((res) => res.value)
				.filter((res): res is DomainResults => !!res);

			domainInformationArr.push(...fulfilledRes);
		}

		return domainInformationArr.filter((res) => res.mxRecords.length);
	}

	private async checkCatchAlls(
		domains: DomainResults[],
		fromEmail: string,
	): Promise<void> {
		await Promise.all(
			domains.map(async (domain) => {
				const smtpVerification = await this.dependencies.smtpVerifier.verify(
					`${this.options.catchAllEmailLocalPart}@${domain.domain}`,
					fromEmail,
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
				.sort((a, b) => b.confidence - a.confidence)
				.slice(0, this.options.numDomainsToVerify),
		};
	}

	private async getBestInferenceCandidate(
		topDomains: DomainResults[],
		topPatterns: EmailPattern[],
		firstName: string,
		lastName: string,
		fromEmail: string,
	): Promise<{
		email: string;
		pattern: EmailPattern;
		domain: DomainResults;
		verification: SMTPVerificationResult;
	}> {
		const smtpRes = await Promise.allSettled(
			topDomains.flatMap((domain) =>
				topPatterns.map(async (pattern) => {
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
							fromEmail,
							domain.mxRecords,
						),
					};
				}),
			),
		);
		const successSmtp = smtpRes
			.filter((smtp) => smtp.status === "fulfilled")
			.map((res) => res.value);
		if (!successSmtp.length) throw new Error("No SMTP Promises were fulfilled");

		const acceptedSMTPResponses = successSmtp.filter(
			(res) => res.verification.status === "accepted",
		);
		if (!acceptedSMTPResponses.length)
			throw new Error("No SMTP Requests were accepted");

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
