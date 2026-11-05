import { EmailPattern, KnownEmailPattern } from "../../shared";
import { extractDomain } from "../../utils";
import { EmailEvidence } from "../EmailEvidenceCollector";
import { AggregatedCatchAllStatus, DomainResults } from "../EmailGenerator";
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
		const domainResultsMap = this.buildDomainResultsMap(
			results.flatMap((res) => res.domainResults),
		);

		for (const result of results) {
			for (const [pattern, count] of result.patternFreq) {
				patternFreq.set(pattern, (patternFreq.get(pattern) ?? 0) + count);
			}
		}

		return {
			patternFreq,
			domainResults: [...Object.values(domainResultsMap)],
		};
	}

	async aggregateEvidence(
		evidence: EmailEvidence[],
	): Promise<DomainAndPatternAggregation> {
		const domainMap = this.buildPreMxLookupMap(evidence);
		const patternFreq = this.buildPatternFreq(evidence);

		const domainResults = await this.enrichDomainsWithMx(domainMap);
		return {
			domainResults,
			patternFreq,
		};
	}

	async aggregateEvidenceAndResults(
		evidence: EmailEvidence[],
		results: DomainResults[],
	): Promise<DomainAndPatternAggregation> {
		//1). create results map
		const domainResultsMap = this.buildDomainResultsMap(results);
		const patternFreq = this.buildPatternFreq(evidence);

		const domainMap = this.buildPreMxLookupMap(evidence);
		for (const [domain, emailEvidenceWithCount] of Object.entries(domainMap)) {
			const prev = domainResultsMap[domain];
			if (prev) {
				domainResultsMap[domain] = {
					...prev,
					count: prev.count + emailEvidenceWithCount.count,
					confidence: Math.max(
						emailEvidenceWithCount.domainConfidence,
						prev.confidence,
					),
				};

				delete domainMap[domain];
			}
		}

		const enrichedDomains = await this.enrichDomainsWithMx(domainMap);

		return {
			domainResults: [...enrichedDomains, ...Object.values(domainResultsMap)],
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

	private buildDomainResultsMap(
		domainResults: DomainResults[],
	): Record<string, DomainResults> {
		const domainResultsMap: Record<string, DomainResults> = {};

		for (const domainResult of domainResults) {
			const existingDomainResult = domainResultsMap[domainResult.domain];
			if (!existingDomainResult) {
				domainResultsMap[domainResult.domain] = { ...domainResult };
				continue;
			}

			domainResultsMap[domainResult.domain] = {
				...existingDomainResult,
				count: existingDomainResult.count + domainResult.count,
				confidence: Math.max(
					existingDomainResult.confidence,
					domainResult.confidence,
				),
				mxRecords: existingDomainResult.mxRecords.length
					? existingDomainResult.mxRecords
					: domainResult.mxRecords,
				catchAll: this.resolveCatchAllStatus(
					existingDomainResult.catchAll,
					domainResult.catchAll,
				),
			};
		}

		return domainResultsMap;
	}

	private buildPreMxLookupMap(
		evidence: EmailEvidence[],
	): Record<string, EmailEvidenceWithCount> {
		const domainMap: Record<string, EmailEvidenceWithCount> = {};

		for (const { email, pattern, source, domainConfidence } of evidence) {
			const domain = extractDomain(email);
			if (!domain) continue;

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

		return domainMap;
	}

	private buildPatternFreq(
		evidence: EmailEvidence[],
	): Map<KnownEmailPattern, number> {
		const patternFreq = new Map<KnownEmailPattern, number>(
			Object.values(EmailPattern)
				.filter((pattern) => pattern !== EmailPattern.Unknown)
				.map((pattern) => [pattern, 0]),
		);

		for (const { email, pattern } of evidence) {
			const domain = extractDomain(email);
			if (!domain) continue;

			if (pattern !== EmailPattern.Unknown)
				patternFreq.set(pattern, (patternFreq.get(pattern) ?? 0) + 1);
		}

		return patternFreq;
	}

	private resolveCatchAllStatus(
		catchAllOne: AggregatedCatchAllStatus,
		catchAllTwo: AggregatedCatchAllStatus,
	): AggregatedCatchAllStatus {
		const set = new Set<AggregatedCatchAllStatus>([catchAllOne, catchAllTwo]);
		if (set.has("conflicting")) return "conflicting";
		if (set.size === 1) return catchAllOne;

		const conflictingOpposites =
			set.has("catch-all") && set.has("not-catch-all");
		if (conflictingOpposites) return "conflicting";

		return catchAllOne === "unknown" ? catchAllTwo : catchAllOne;
	}
}
