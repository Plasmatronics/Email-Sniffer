import { describe, expect, test, vi } from "vitest";
import { DomainConfidenceScorer } from "../DomainConfidenceScorer";
import { DocumentClamper } from "../DocumentClamper";
import { EmailExtractor } from "../EmailExtractor";
import { EmailPattern } from "../../shared";
import { EmailPatternInferrer } from "../EmailPatternInferrer";
import { MXRecordRetriever } from "../MXRecordRetriever";
import { SMTPVerifier } from "../SMTPVerifier";
import { TextChunker } from "../TextChunker";
import { WebsiteEmailCrawler } from "../WebsiteEmailCrawler";
import { validateEmail } from "../../utils";
import { EmailGenerator } from "./EmailGenerator";

const COMPANY_URL = "https://example.com";

function createGenerator() {
	const mxRecordRetriever = new MXRecordRetriever();
	const websiteEmailCrawler = new WebsiteEmailCrawler(
		[],
		new EmailExtractor(new TextChunker(), new DocumentClamper()),
		new EmailPatternInferrer(new TextChunker()),
	);
	const domainConfidenceScorer = new DomainConfidenceScorer();
	const smtpVerifier = new SMTPVerifier(
		"verification@example.com",
		"test.example",
	);

	const verify = vi
		.spyOn(smtpVerifier, "verify")
		.mockImplementation(async (email) => {
			if (!validateEmail(email)) {
				return {
					status: "error",
					message: `${email} is not a valid email`,
				};
			}

			if (email.startsWith("emailSnifferCatchAllTestingLocal")) {
				return {
					status: "rejected",
					code: 550,
					message: "mailbox unavailable",
				};
			}

			return {
				status: "accepted",
				code: 250,
				message: "mailbox accepted",
			};
		});

	return {
		generator: new EmailGenerator(
			{
				mxRecordRetriever,
				websiteEmailCrawler,
				domainConfidenceScorer,
				smtpVerifier,
			},
			{
				companyUrlPagesSearchNum: 20,
				catchAllConfidencePenalty: 20,
				catchAllEmailLocalPart: "emailSnifferCatchAllTestingLocal",
				numPatternsToVerify: 5,
				numDomainsToVerify: 5,
			},
		),
		mxRecordRetriever,
		websiteEmailCrawler,
		verify,
	};
}

describe("EmailGenerator", () => {
	test("returns the accepted candidate generated from a crawled pattern", async () => {
		const { generator, mxRecordRetriever, websiteEmailCrawler } =
			createGenerator();
		vi.spyOn(mxRecordRetriever, "findMXRecords").mockResolvedValue([
			"mx.example.com",
		]);
		vi.spyOn(websiteEmailCrawler, "crawl").mockResolvedValue({
			[`${COMPANY_URL}/contact`]: [
				{
					email: "alice.smith@example.com",
					pattern: EmailPattern.FirstNameDotLastName,
				},
			],
		});

		await expect(
			generator.inferEmail({
				firstName: "alice",
				lastName: "smith",
				companyUrl: COMPANY_URL,
			}),
		).resolves.toMatchObject({
			success: true,
			pattern: EmailPattern.FirstNameDotLastName,
			inferredEmail: "alice.smith@example.com",
		});
	});

	test("shares one MX lookup for concurrent emails from the same domain", async () => {
		const { generator, mxRecordRetriever, websiteEmailCrawler } =
			createGenerator();
		const findMXRecords = vi
			.spyOn(mxRecordRetriever, "findMXRecords")
			.mockImplementation(async (mailTo) =>
				mailTo === COMPANY_URL ? [] : ["mx.example2.com"],
			);
		vi.spyOn(websiteEmailCrawler, "crawl").mockResolvedValue({
			[`${COMPANY_URL}/contact`]: [
				{
					email: "alice.smith@example2.com",
					pattern: EmailPattern.FirstNameDotLastName,
				},
				{
					email: "alice_smith@example2.com",
					pattern: EmailPattern.FirstNameUnderscoreLastName,
				},
			],
		});

		await generator.inferEmail({
			firstName: "alice",
			lastName: "smith",
			companyUrl: COMPANY_URL,
		});

		expect(
			findMXRecords.mock.calls.filter(([email]) =>
				email.includes("@example2.com"),
			),
		).toHaveLength(1);
	});

	test("does not count unknown patterns when selecting a pattern", async () => {
		const { generator, mxRecordRetriever, websiteEmailCrawler } =
			createGenerator();
		vi.spyOn(mxRecordRetriever, "findMXRecords").mockResolvedValue([
			"mx.example.com",
		]);
		vi.spyOn(websiteEmailCrawler, "crawl").mockResolvedValue({
			[`${COMPANY_URL}/privacy`]: [
				{ email: "privacy@example.com", pattern: EmailPattern.Unknown },
				{ email: "privacy2@example.com", pattern: EmailPattern.Unknown },
			],
			[`${COMPANY_URL}/contact`]: [
				{
					email: "alice.smith@example.com",
					pattern: EmailPattern.FirstNameDotLastName,
				},
			],
		});

		await expect(
			generator.inferEmail({
				firstName: "alice",
				lastName: "smith",
				companyUrl: COMPANY_URL,
			}),
		).resolves.toMatchObject({
			success: true,
			pattern: EmailPattern.FirstNameDotLastName,
		});
	});
});
