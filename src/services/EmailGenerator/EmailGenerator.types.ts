import { EmailPattern } from "../../shared";
import { CompanyDomainValidator } from "../CompanyDomainValidator";
import { MXRecordRetriever } from "../MXRecordRetriever";
import { SMTPVerifier } from "../SMTPVerifier";
import { WebsiteEmailCrawler } from "../WebsiteEmailCrawler";

export interface SearchInformation {
	firstName: string;
	lastName: string;
	companyUrl: string;
}

export interface EmailGeneratorDependencies {
	mxRecordRetriever: MXRecordRetriever;
	websiteEmailCrawler: WebsiteEmailCrawler;
	domainValidator: CompanyDomainValidator;
	smtpVerifier: SMTPVerifier;
}

export interface EmailGeneratorOptions {
	maxPages: number;
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
