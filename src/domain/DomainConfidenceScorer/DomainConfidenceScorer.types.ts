export interface VerifiedDomainData {
	confidence: number;
	domain: string;
	verificationResult: VerificationResult;
}

export interface DomainConfidenceScorerConfig {
	substringMatchPassThreshold: number;
	overallPassThreshold: number;
	overallFailMaximum: number;
}

export enum VerificationResult {
	Pass,
	Uncertain,
	Fail,
}
