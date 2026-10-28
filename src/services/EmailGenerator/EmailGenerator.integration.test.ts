import net, { type AddressInfo, type Server } from "node:net";
import axios, { type AxiosResponse } from "axios";
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import { DomainConfidenceScorer } from "../DomainConfidenceScorer";
import { DocumentClamper } from "../DocumentClamper";
import { EmailExtractor } from "../EmailExtractor";
import { EmailPattern } from "../../shared";
import { EmailPatternInferrer } from "../EmailPatternInferrer";
import { MXRecordRetriever } from "../MXRecordRetriever";
import { SMTPVerifier } from "../SMTPVerifier";
import { TextChunker } from "../TextChunker";
import { WebsiteEmailCrawler } from "../WebsiteEmailCrawler";
import {
	HTMLParserStrategy,
	PDFParserStrategy,
} from "../WebsiteEmailCrawler/ParserStrategy";
import { EmailGenerator } from "./EmailGenerator";

describe("EmailGenerator integration", () => {
	let server: Server;
	let createConnectionSpy: ReturnType<typeof vi.spyOn>;

	beforeAll(async () => {
		server = net.createServer((socket) => {
			socket.write("220 localhost ready\r\n");
			let requestBuffer = "";

			socket.on("data", (chunk) => {
				requestBuffer += chunk.toString();
				let lineEnd = requestBuffer.indexOf("\r\n");

				while (lineEnd >= 0) {
					const command = requestBuffer.slice(0, lineEnd);
					requestBuffer = requestBuffer.slice(lineEnd + 2);

					if (command.startsWith("EHLO "))
						socket.write("250-localhost\r\n250 PIPELINING\r\n");
					else if (command.startsWith("MAIL FROM:"))
						socket.write("250 sender ok\r\n");
					else if (command.startsWith("RCPT TO:"))
						socket.write("250 recipient ok\r\n");

					lineEnd = requestBuffer.indexOf("\r\n");
				}
			});
		});

		await new Promise<void>((resolve, reject) => {
			server.once("error", reject);
			server.listen(0, "127.0.0.1", resolve);
		});

		const address = server.address() as AddressInfo;
		const connect = net.createConnection.bind(net);
		createConnectionSpy = vi
			.spyOn(net, "createConnection")
			.mockImplementation((() =>
				connect({
					host: "127.0.0.1",
					port: address.port,
				})) as typeof net.createConnection);
	});

	afterAll(async () => {
		createConnectionSpy.mockRestore();
		await new Promise<void>((resolve, reject) => {
			server.close((error) => (error ? reject(error) : resolve()));
		});
	});

	test("infers a crawled email through a real SMTP verifier", async () => {
		vi.spyOn(axios, "get").mockResolvedValue({
			headers: { "content-type": "text/html; charset=utf-8" },
			data: Buffer.from(`
				<html>
					<body>
						<h1>Contact Alice Smith</h1>
						<p>Email alice.smith@example.com</p>
					</body>
				</html>
			`),
		} as AxiosResponse<Buffer>);

		const mxRecordRetriever = new MXRecordRetriever();
		vi.spyOn(mxRecordRetriever, "findMXRecords").mockResolvedValue([
			"mx.example.com",
		]);

		const websiteEmailCrawler = new WebsiteEmailCrawler(
			[new HTMLParserStrategy(), new PDFParserStrategy()],
			new EmailExtractor(new TextChunker(), new DocumentClamper()),
			new EmailPatternInferrer(new TextChunker()),
		);

		const generator = new EmailGenerator(
			{
				mxRecordRetriever,
				websiteEmailCrawler,
				domainConfidenceScorer: new DomainConfidenceScorer(),
				smtpVerifier: new SMTPVerifier("verification@example.com", "localhost"),
			},
			{
				companyUrlPagesSearchNum: 20,
				catchAllConfidencePenalty: 20,
				catchAllEmailLocalPart: "emailSnifferCatchAllTestingLocal",
				numPatternsToVerify: 5,
				numDomainsToVerify: 5,
			},
		);

		await expect(
			generator.inferEmail({
				firstName: "alice",
				lastName: "smith",
				companyUrl: "https://example.com",
			}),
		).resolves.toMatchObject({
			success: true,
			pattern: EmailPattern.FirstNameDotLastName,
			inferredEmail: "alice.smith@example.com",
		});
	});
});
