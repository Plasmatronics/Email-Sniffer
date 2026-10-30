import { configDotenv } from "dotenv";
import express from "express";
import z from "zod";
import {
	DomainConfidenceScorer,
	DocumentClamper,
	EmailExtractor,
	EmailGenerator,
	HTMLParserStrategy,
	MXRecordRetriever,
	PDFParserStrategy,
	SMTPVerifier,
	TextChunker,
	WebsiteEmailCrawler,
	SerperClient,
	SnifferIntegration,
	EmailPatternInferrer,
	WebSearcher,
	PdfSearchCollector,
	CompanyWebsiteCollector,
	DomainResultAndPatternAggregator,
	InferredEmailConfidenceScorer,
} from "./src";

configDotenv({ path: "./.env" });

const {
	FROM_MAILBOX: fromEmail,
	SMTP_EHLO_HOSTNAME: ehloHostName,
	SERVER_PORT: serverPort,
	SERPER_API_KEY: apiKey,
} = process.env;
if (!fromEmail)
	throw new Error("Missing configuration variable for FROM_MAILBOX");
if (!ehloHostName)
	throw new Error("Missing configuration variable for SMTP_EHLO_HOSTNAME");
if (!serverPort)
	throw new Error("Missing configuration variable for SERVER_PORT");
if (!apiKey)
	throw new Error("Missing configuration variable for SERPER_API_KEY");

const serverPortNumber = Number(serverPort);
if (
	!Number.isInteger(serverPortNumber) ||
	serverPortNumber <= 0 ||
	serverPortNumber > 65535
) {
	throw new Error("Invalid SERVER_PORT");
}

const webSearcher = new WebSearcher(new SerperClient(apiKey));
const websiteCrawler = new WebsiteEmailCrawler(
	[new HTMLParserStrategy(), new PDFParserStrategy()],
	new EmailExtractor(new TextChunker(), new DocumentClamper()),
	new EmailPatternInferrer(new TextChunker()),
);
const domainConfidenceScorer = new DomainConfidenceScorer();
const mxRecordRetriever = new MXRecordRetriever();

const emailGenerator = new EmailGenerator(
	{
		pdfEmailEvidenceCollector: new PdfSearchCollector({
			webSearcher,
			websiteCrawler,
			domainConfidenceScorer,
		}),
		companyWebsiteEmailEvidenceCollector: new CompanyWebsiteCollector(
			{ websiteCrawler, domainConfidenceScorer },
			{ numPagesToCrawl: 20 },
		),
		smtpVerifier: new SMTPVerifier(fromEmail, ehloHostName),
		domainResultAndPatternAggregator: new DomainResultAndPatternAggregator(
			mxRecordRetriever,
		),
		mxRecordRetriever,
		domainConfidenceScorer,
		inferredEmailConfidenceScorer: new InferredEmailConfidenceScorer({
			passingScore: 75,
			weights: {
				smtpWeight: 35,
				domainWeight: 25,
				patternWeight: 40,
			},
		}),
	},
	{
		catchAllEmailLocalPart: "emailSnifferCatchAllTestingLocal",
		numPatternsToVerify: 5,
		numDomainsToVerify: 3,
	},
);

const app = express();
app.use(express.json());

app.post("/email-inferences", async (req, res) => {
	try {
		const InferenceArgumentsSchema = z.object({
			firstName: z.string().min(2),
			lastName: z.string().min(2),
			companyUrl: z.string(),
		});

		const { firstName, lastName, companyUrl } = InferenceArgumentsSchema.parse(
			req.body,
		);

		const inferenceResults = await emailGenerator.inferEmail({
			firstName,
			lastName,
			companyUrl,
		});

		return res.status(200).send(inferenceResults);
	} catch (err: unknown) {
		if (err instanceof z.ZodError) {
			return res.status(400).send({
				error: "Invalid request body",
				details: err.issues,
			});
		}

		console.error("Email inference failed", err);
		return res.status(500).send({ error: "Unable to infer an email address" });
	}
});

const vitalIntegrations: SnifferIntegration[] = [new SerperClient(apiKey)];
app.get("/health", async (_req, res) => {
	const healthChecks = await Promise.all(
		vitalIntegrations.map((integration) => integration.healthCheck()),
	);

	const response = {
		healthy: healthChecks.filter((check) => check.isHealthy),
		unhealthy: healthChecks.filter((check) => !check.isHealthy),
	};

	return res.status(response.unhealthy.length > 0 ? 503 : 200).send(response);
});

const server = app.listen(serverPortNumber, () => {
	console.log(`app listening on port ${serverPortNumber}`);
});

const shutdown = (signal: string) => {
	console.log(`Received ${signal}, closing server connection`);

	server.close((err) => {
		if (err) {
			console.error(err);
			process.exit(1);
		}

		process.exit(0);
	});
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
