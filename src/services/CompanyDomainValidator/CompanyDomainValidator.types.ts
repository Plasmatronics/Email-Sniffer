export interface VerifiedDomainData {
	confidence: number;
	domain: string;
	verificationResult: VerificationResult;
}

export interface DomainValidatorConfig {
	substringMatchPassThreshold: number;
	overallPassThreshold: number;
	overallFailMaximum: number;
}

export enum VerificationResult {
	Pass,
	Uncertain,
	Fail,
}
