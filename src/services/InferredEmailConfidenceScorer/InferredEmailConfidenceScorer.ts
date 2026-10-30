import { KnownEmailPattern } from "../../shared";
import {
	EmailInferenceCandidate,
	EmailInferenceResults,
} from "../EmailGenerator";

export interface EmailScorerWeights {
	domainWeight: number;
	smtpWeight: number;
	patternWeight: number;
}

export interface InferredEmailConfidenceScorerConfig {
	passingScore: number;
	weights: EmailScorerWeights;
}

const MAX_SCORE = 100;
const MIN_SCORE = 0;
const DOMAIN_CONFIDENCE_EXPONENT = 2;

export class InferredEmailConfidenceScorer {
	constructor(private config: InferredEmailConfidenceScorerConfig) {
		const normalizedWeights = this.normalizeWeights(config.weights);
		const normalizedPassingScore = this.clampScore(config.passingScore);
		this.config = {
			...this.config,
			weights: normalizedWeights,
			passingScore: normalizedPassingScore,
		};
	}

	scoreCandidates(
		results: EmailInferenceCandidate[],
		topPatterns: Map<KnownEmailPattern, number>,
	): EmailInferenceResults[] {
		return results.map((res) => {
			const domainContribution =
				this.calculateDomainContribution(res.domainConfidence) *
				this.config.weights.domainWeight;
			const calculateSMTPContribution =
				this.calculateSMTPContribution(
					res.smtpVerificationResult,
					res.catchAll,
				) * this.config.weights.smtpWeight;
			const patternFreqContribution =
				this.calculatePatternContribution(res.pattern, topPatterns) *
				this.config.weights.patternWeight;

			const score = this.clampScore(
				Math.ceil(
					domainContribution +
						calculateSMTPContribution +
						patternFreqContribution,
				),
			);

			if (score >= this.config.passingScore) {
				return {
					catchAll: res.catchAll === "conflicting" ? "unknown" : res.catchAll,
					confidence: score,
					success: true,
					pattern: res.pattern,
					inferredEmail: res.email,
				};
			} else {
				return {
					success: false,
					reason: `Inference failed to meet the passing score of ${this.config.passingScore}`,
				};
			}
		});
	}

	private calculateDomainContribution(domainConfidence: number): number {
		const normalizedConfidence = this.clampScore(domainConfidence) / MAX_SCORE;
		return this.clampScore(
			Math.pow(normalizedConfidence, DOMAIN_CONFIDENCE_EXPONENT) * MAX_SCORE,
		);
	}

	private calculatePatternContribution(
		pattern: KnownEmailPattern,
		patternMap: Map<KnownEmailPattern, number>,
	): number {
		const totalPatternCount = patternMap
			.values()
			.reduce((total, count) => total + count, 0);
		if (totalPatternCount <= 0) return 0;

		const patternCount = patternMap.get(pattern) ?? 0;
		return this.clampScore(patternCount / totalPatternCount) * MAX_SCORE;
	}

	private calculateSMTPContribution(
		smtpRes: EmailInferenceCandidate["smtpVerificationResult"],
		catchAllStatus: EmailInferenceCandidate["catchAll"],
	) {
		let score = 0;
		if (smtpRes.status !== "accepted") return score;

		score += 50;
		if (catchAllStatus === "not-catch-all") score += 50;
		else if (catchAllStatus !== "catch-all") score += 15;

		return this.clampScore(score);
	}

	private clampScore(score: number) {
		return Math.min(Math.max(score, MIN_SCORE), MAX_SCORE);
	}

	private normalizeWeights(weights: EmailScorerWeights): EmailScorerWeights {
		const total = Object.values(weights).reduce((acc, cur) => acc + cur, 0);
		if (total === 1) return weights;

		if (total !== 100)
			throw new Error(`Weights do not add to a total of ${MAX_SCORE}`);

		return Object.fromEntries(
			Object.entries(weights).map(([key, weight]) => [key, weight / 100]),
		) as unknown as EmailScorerWeights;
	}
}
