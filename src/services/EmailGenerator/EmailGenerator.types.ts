import { EmailPattern } from "../../shared";
import { DomainConfidenceScorer } from "../DomainConfidenceScorer";
import { MXRecordRetriever } from "../MXRecordRetriever";
import { SMTPVerifier } from "../SMTPVerifier";
import { WebSearcher } from "../WebSearcher";
import { WebsiteEmailCrawler } from "../WebsiteEmailCrawler";

export interface SearchInformation {
	firstName: string;
	lastName: string;
	companyUrl: string;
}

export interface EmailGeneratorDependencies {
	mxRecordRetriever: MXRecordRetriever;
	websiteEmailCrawler: WebsiteEmailCrawler;
	domainConfidenceScorer: DomainConfidenceScorer;
	smtpVerifier: SMTPVerifier;
	webSearcher: WebSearcher;
}

export interface EmailGeneratorOptions {
	companyUrlPagesSearchNum: number;
	catchAllConfidencePenalty: number;
	catchAllEmailLocalPart: string;
	numPatternsToVerify: number;
	numDomainsToVerify: number;
}

type CatchAllStatus = "catch-all" | "not-catch-all" | "unknown";

export interface DomainResults {
	domain: string;
	mxRecords: string[];
	confidence: number;
	catchAll: CatchAllStatus;
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
