import { EmailPattern, KnownEmailPattern } from "../../shared";
import { DomainConfidenceScorer } from "../DomainConfidenceScorer";
import { DomainResultAndPatternAggregator } from "../DomainResultAndPatternAggregator";
import {
	CompanyWebsiteCollector,
	PdfSearchCollector,
} from "../EmailEvidenceCollector";
import { InferredEmailConfidenceScorer } from "../InferredEmailConfidenceScorer";
import { MXRecordRetriever } from "../MXRecordRetriever";
import { SMTPVerificationResult, SMTPVerifier } from "../SMTPVerifier";

export interface SearchInformation {
	firstName: string;
	lastName: string;
	companyUrl: string;
}

export interface EmailGeneratorDependencies {
	pdfEmailEvidenceCollector: PdfSearchCollector;
	companyWebsiteEmailEvidenceCollector: CompanyWebsiteCollector;
	smtpVerifier: SMTPVerifier;
	domainResultAndPatternAggregator: DomainResultAndPatternAggregator;
	mxRecordRetriever: MXRecordRetriever;
	domainConfidenceScorer: DomainConfidenceScorer;
	inferredEmailConfidenceScorer: InferredEmailConfidenceScorer;
}

export interface EmailGeneratorOptions {
	catchAllEmailLocalPart: string;
	numPatternsToVerify: number;
	numDomainsToVerify: number;
}

export type CatchAllStatus = "catch-all" | "not-catch-all" | "unknown";
export type AggregatedCatchAllStatus = CatchAllStatus | "conflicting";

export interface DomainResults {
	domain: string;
	mxRecords: string[];
	confidence: number;
	catchAll: AggregatedCatchAllStatus;
	count: number;
}

export interface EmailInferenceCandidate {
	catchAll: AggregatedCatchAllStatus;
	domainConfidence: number;
	smtpVerificationResult: SMTPVerificationResult;
	pattern: KnownEmailPattern;
	email: string;
}

export interface SuccessfulEmailInferenceResults {
	catchAll: CatchAllStatus;
	confidence: number;
	success: true;
	pattern: KnownEmailPattern;
	inferredEmail: string;
}

export interface FailedEmailInferenceResults {
	success: false;
	reason: string;
}

export type EmailInferenceResults =
	SuccessfulEmailInferenceResults | FailedEmailInferenceResults;
