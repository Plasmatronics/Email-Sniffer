import { EmailPattern } from "../../shared";
import { DomainConfidenceScorer } from "../DomainConfidenceScorer";
import { DomainResultAndPatternAggregator } from "../DomainResultAndPatternAggregator";
import {
	CompanyWebsiteCollector,
	PdfSearchCollector,
} from "../EmailEvidenceCollector";
import { MXRecordRetriever } from "../MXRecordRetriever";
import { SMTPVerifier } from "../SMTPVerifier";

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
}

export interface EmailGeneratorOptions {
	catchAllConfidencePenalty: number;
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

export interface SuccessfulEmailInferenceResults {
	catchAll: CatchAllStatus;
	confidence: number;
	success: true;
	pattern: EmailPattern;
	inferredEmail: string;
}

export interface FailedEmailInferenceResults {
	success: false;
	reason: string;
}

export type EmailInferenceResults =
	SuccessfulEmailInferenceResults | FailedEmailInferenceResults;
