import { describe, expect, test, vi } from "vitest";
import { EmailPattern } from "../../shared";
import type { EmailEvidence } from "../EmailEvidenceCollector";
import { MXRecordRetriever } from "../MXRecordRetriever";
import { DomainResultAndPatternAggregator } from "./DomainResultAndPatternAggregator";

function createEvidence(
	values: Partial<EmailEvidence> & Pick<EmailEvidence, "email">,
): EmailEvidence {
	return {
		email: values.email,
		pattern: values.pattern ?? EmailPattern.FirstName,
		source: values.source ?? "https://example.com/contact",
		domainConfidence: values.domainConfidence ?? 50,
	};
}

describe("DomainResultAndPatternAggregator", () => {
	test("combines domain and pattern results", () => {
		const aggregator = new DomainResultAndPatternAggregator(
			new MXRecordRetriever(),
		);

		const result = aggregator.aggregateResults([
			{
				patternFreq: new Map([[EmailPattern.FirstName, 2]]),
				domainResults: [
					{
						domain: "example.com",
						count: 2,
						confidence: 50,
						mxRecords: [],
						catchAll: "unknown",
					},
				],
			},
			{
				patternFreq: new Map([[EmailPattern.FirstName, 1]]),
				domainResults: [
					{
						domain: "example.com",
						count: 1,
						confidence: 100,
						mxRecords: ["mx.example.com"],
						catchAll: "not-catch-all",
					},
				],
			},
		]);

		expect(result).toEqual({
			patternFreq: new Map([[EmailPattern.FirstName, 3]]),
			domainResults: [
				{
					domain: "example.com",
					count: 3,
					confidence: 100,
					mxRecords: ["mx.example.com"],
					catchAll: "not-catch-all",
				},
			],
		});
	});

	test("keeps conflicting catch-all results sticky", () => {
		const aggregator = new DomainResultAndPatternAggregator(
			new MXRecordRetriever(),
		);
		const domainResult = (catchAll: "catch-all" | "not-catch-all") => ({
			domain: "example.com",
			count: 1,
			confidence: 50,
			mxRecords: [],
			catchAll,
		});

		const result = aggregator.aggregateResults([
			{
				patternFreq: new Map(),
				domainResults: [domainResult("catch-all")],
			},
			{
				patternFreq: new Map(),
				domainResults: [domainResult("not-catch-all")],
			},
			{
				patternFreq: new Map(),
				domainResults: [domainResult("catch-all")],
			},
		]);

		expect(result.domainResults[0].catchAll).toBe("conflicting");
	});

	test("aggregates evidence by domain and performs one MX lookup per domain", async () => {
		const mxRecordRetriever = new MXRecordRetriever();
		const findMXRecords = vi
			.spyOn(mxRecordRetriever, "findMXRecords")
			.mockImplementation(async (domain) => [`mx.${domain}`]);
		const aggregator = new DomainResultAndPatternAggregator(mxRecordRetriever);

		const result = await aggregator.aggregateEvidence([
			createEvidence({
				email: "alice@example.com",
				domainConfidence: 50,
			}),
			createEvidence({
				email: "bDororthy@example.com",
				pattern: EmailPattern.FirstInitialLastName,
				domainConfidence: 100,
			}),
			createEvidence({
				email: "carol@other.example",
				domainConfidence: 75,
			}),
		]);

		expect(findMXRecords).toHaveBeenCalledTimes(2);
		expect(result.domainResults).toEqual([
			{
				domain: "example.com",
				count: 2,
				confidence: 100,
				mxRecords: ["mx.example.com"],
				catchAll: "unknown",
			},
			{
				domain: "other.example",
				count: 1,
				confidence: 75,
				mxRecords: ["mx.other.example"],
				catchAll: "unknown",
			},
		]);
	});

	test("merges evidence into existing results and looks up only new domains", async () => {
		const mxRecordRetriever = new MXRecordRetriever();
		const findMXRecords = vi
			.spyOn(mxRecordRetriever, "findMXRecords")
			.mockResolvedValue(["mx.other.example"]);
		const aggregator = new DomainResultAndPatternAggregator(mxRecordRetriever);

		const result = await aggregator.aggregateEvidenceAndResults(
			[
				createEvidence({
					email: "alice@example.com",
					domainConfidence: 100,
				}),
				createEvidence({ email: "carol@other.example", domainConfidence: 75 }),
			],
			[
				{
					domain: "example.com",
					count: 2,
					confidence: 50,
					mxRecords: ["mx.example.com"],
					catchAll: "unknown",
				},
			],
		);

		expect(findMXRecords).toHaveBeenCalledTimes(1);
		expect(findMXRecords).toHaveBeenCalledWith("other.example");
		expect(result.domainResults).toEqual([
			{
				domain: "other.example",
				count: 1,
				confidence: 75,
				mxRecords: ["mx.other.example"],
				catchAll: "unknown",
			},
			{
				domain: "example.com",
				count: 3,
				confidence: 100,
				mxRecords: ["mx.example.com"],
				catchAll: "unknown",
			},
		]);
	});

	test("counts unknown-pattern evidence without adding it to pattern frequencies", async () => {
		const mxRecordRetriever = new MXRecordRetriever();
		vi.spyOn(mxRecordRetriever, "findMXRecords").mockResolvedValue([
			"mx.example.com",
		]);
		const aggregator = new DomainResultAndPatternAggregator(mxRecordRetriever);

		const result = await aggregator.aggregateEvidence([
			createEvidence({
				email: "unknown@example.com",
				pattern: EmailPattern.Unknown,
			}),
			createEvidence({ email: "known@example.com" }),
		]);

		expect(result.domainResults[0]).toMatchObject({
			domain: "example.com",
			count: 2,
		});
		//@ts-expect-error Checking Unknown for error verification purposes
		expect(result.patternFreq.get(EmailPattern.Unknown)).toBeUndefined();
		expect(result.patternFreq.get(EmailPattern.FirstName)).toBe(1);
	});

	test("omits domains whose MX lookup fails", async () => {
		const mxRecordRetriever = new MXRecordRetriever();
		vi.spyOn(mxRecordRetriever, "findMXRecords").mockRejectedValue(
			new Error("DNS lookup failed"),
		);
		const aggregator = new DomainResultAndPatternAggregator(mxRecordRetriever);

		const result = await aggregator.aggregateEvidence([
			createEvidence({ email: "alice@example.com" }),
		]);

		expect(result.domainResults).toEqual([]);
	});
});
