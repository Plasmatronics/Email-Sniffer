import { EmailPattern, KnownEmailPattern } from "../../shared";
import { extractDomain } from "../../utils";
import { EmailEvidence } from "../EmailEvidenceCollector";
import { DomainResults } from "../EmailGenerator";
import { MXRecordRetriever } from "../MXRecordRetriever";

export interface DomainAndPatternAggregation {
	patternFreq: Map<KnownEmailPattern, number>;
	domainResults: DomainResults[];
}

export interface EmailEvidenceWithCount extends EmailEvidence {
	count: number;
}

export class DomainResultAndPatternAggregator {
	constructor(private mxRecordRetriever: MXRecordRetriever) {}

	aggregateResults(
		results: DomainAndPatternAggregation[],
	): DomainAndPatternAggregation {
		const patternFreq = new Map<KnownEmailPattern, number>();
		const domainResultsMap = new Map<string, DomainResults>();

		for (const result of results) {
			for (const [pattern, count] of result.patternFreq) {
				patternFreq.set(pattern, (patternFreq.get(pattern) ?? 0) + count);
			}

			for (const domainResult of result.domainResults) {
				const existingDomainResult = domainResultsMap.get(domainResult.domain);
				if (!existingDomainResult) {
					domainResultsMap.set(domainResult.domain, { ...domainResult });
					continue;
				}

				domainResultsMap.set(domainResult.domain, {
					...existingDomainResult,
					count: existingDomainResult.count + domainResult.count,
					confidence: Math.max(
						existingDomainResult.confidence,
						domainResult.confidence,
					),
					mxRecords: existingDomainResult.mxRecords.length
						? existingDomainResult.mxRecords
						: domainResult.mxRecords,
					catchAll:
						existingDomainResult.catchAll === "unknown"
							? domainResult.catchAll
							: existingDomainResult.catchAll,
				});
			}
		}

		return {
			patternFreq,
			domainResults: [...domainResultsMap.values()],
		};
	}

	async aggregateEvidence(
		evidence: EmailEvidence[],
	): Promise<DomainAndPatternAggregation> {
		const domainMap: Record<string, EmailEvidenceWithCount> = {};
		const patternFreq = new Map<KnownEmailPattern, number>(
			Object.values(EmailPattern)
				.filter((pattern) => pattern !== EmailPattern.Unknown)
				.map((pattern) => [pattern, 0]),
		);

		for (const { email, pattern, source, domainConfidence } of evidence) {
			const domain = extractDomain(email);
			if (!domain) continue;

			if (pattern !== EmailPattern.Unknown)
				patternFreq.set(pattern, (patternFreq.get(pattern) ?? 0) + 1);
			const existingDomainRecord = domainMap[domain];
			if (
				!existingDomainRecord ||
				domainConfidence > existingDomainRecord.domainConfidence
			) {
				domainMap[domain] = {
					email,
					pattern,
					source,
					domainConfidence,
					count: existingDomainRecord?.count ?? 0,
				};
			}

			domainMap[domain].count++;
		}

		const domainResults = await this.enrichDomainsWithMx(domainMap);
		return {
			domainResults,
			patternFreq,
		};
	}

	private async enrichDomainsWithMx(
		domainMap: Record<string, EmailEvidenceWithCount>,
	): Promise<DomainResults[]> {
		const domainResults = await Promise.allSettled(
			Object.entries(domainMap).map(
				async ([domain, emailEvidenceWithCount]): Promise<DomainResults> => {
					const mxRecords = await this.mxRecordRetriever.findMXRecords(domain);

					return {
						domain,
						count: emailEvidenceWithCount.count,
						confidence: emailEvidenceWithCount.domainConfidence,
						mxRecords,
						catchAll: "unknown",
					};
				},
			),
		);

		const errors = domainResults
			.filter((res) => res.status === "rejected")
			.map((res) => res.reason);
		if (errors.length) console.error(errors);

		return domainResults
			.filter((res) => res.status === "fulfilled")
			.map((res) => res.value);
	}
}
