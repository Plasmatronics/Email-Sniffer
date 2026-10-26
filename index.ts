import { configDotenv } from "dotenv";
import {
	CompanyDomainValidator,
	DocumentClamper,
	EmailExtractor,
	EmailGenerator,
	HTMLParserStrategy,
	MXRecordRetriever,
	PDFParserStrategy,
	SMTPVerifier,
	TextChunker,
	WebsiteEmailCrawler,
} from "./src/services";
import { EmailPatternInferrer } from "./src/services/EmailPatternInferrer";
import type { EmailInferenceResults } from "./src/services/EmailGenerator/EmailGenerator.types";

configDotenv({ path: "./.env" });

const fromEmail = process.env.FROM_MAILBOX;
if (!fromEmail)
	throw new Error("Missing configuration variable for FROM_MAILBOX");

const emailGenerator = new EmailGenerator(
	{
		mxRecordRetriever: new MXRecordRetriever(),
		websiteEmailCrawler: new WebsiteEmailCrawler(
			[new HTMLParserStrategy(), new PDFParserStrategy()],
			new EmailExtractor(new TextChunker(), new DocumentClamper()),
			new EmailPatternInferrer(new TextChunker()),
		),
		domainValidator: new CompanyDomainValidator(),
		smtpVerifier: new SMTPVerifier(),
	},
	{
		fromEmail,
		maxPages: 20,
		catchAllConfidencePenalty: 20,
		catchAllEmailLocalPart: "emailSnifferCatchAllTestingLocal",
		numPatternsToVerify: 5,
		numDomainsToVerify: 5,
	},
);

export function inferEmail(
	firstName: string,
	lastName: string,
	companyUrl: string,
): Promise<EmailInferenceResults> {
	return emailGenerator.inferEmail({ firstName, lastName, companyUrl });
}
