import { loadEnv } from "./src/config";
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
	PlaywrightWebsiteFetcher,
} from "./src";

const {
	fromEmail,
	ehloHostName,
	serverPort: serverPortNumber,
	apiKey,
} = loadEnv();

let websiteFetcher: PlaywrightWebsiteFetcher;
try {
	websiteFetcher = await PlaywrightWebsiteFetcher.createFetcher({});
} catch (error: unknown) {
	console.error("Failed to launch Playwright browser:", error);
	process.exit(1);
}

const webSearcher = new WebSearcher(new SerperClient(apiKey));
const websiteCrawler = new WebsiteEmailCrawler(
	[new HTMLParserStrategy(), new PDFParserStrategy()],
	new EmailExtractor(new TextChunker(), new DocumentClamper()),
	new EmailPatternInferrer(new TextChunker()),
	websiteFetcher,
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

let shuttingDown = false;

const shutdown = (signal: string) => {
	if (shuttingDown) return;
	shuttingDown = true;

	console.log(`Received ${signal}, shutting down`);

	server.close(async (err) => {
		if (err) {
			console.error(err);
			process.exitCode = 1;
		}
		try {
			await websiteFetcher.close();
		} catch (err: unknown) {
			console.error("Browser shutdown failed", err);
			process.exitCode = 1;
		}
	});
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
