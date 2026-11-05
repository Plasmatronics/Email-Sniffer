import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { EmailPattern, type KnownEmailPattern } from "../../shared";
import type { EmailInferenceCandidate } from "../EmailGenerator";
import { InferredEmailConfidenceScorer } from "./InferredEmailConfidenceScorer";

const CONFIG = {
	passingScore: 75,
	weights: {
		domainWeight: 0.15,
		patternWeight: 0.35,
		smtpWeight: 0.5,
	},
};

function createCandidate(
	values: Partial<EmailInferenceCandidate> = {},
): EmailInferenceCandidate {
	return {
		catchAll: "not-catch-all",
		domainConfidence: 100,
		email: "alice.smith@example.com",
		pattern: EmailPattern.FirstNameDotLastName,
		smtpVerificationResult: {
			status: "accepted",
			code: 250,
			message: "mailbox accepted",
		},
		...values,
	};
}

function scoreWith(
	config: typeof CONFIG,
	candidate: EmailInferenceCandidate,
	topPatterns: Map<KnownEmailPattern, number> = new Map([
		[EmailPattern.FirstNameDotLastName, 1],
	]),
) {
	return new InferredEmailConfidenceScorer(config).scoreCandidates(
		[candidate],
		topPatterns,
	)[0];
}

describe("InferredEmailConfidenceScorer", () => {
	beforeEach(() => {
		vi.spyOn(console, "log").mockImplementation(() => {});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	test("rejects weights that do not total 1 or 100", () => {
		expect(
			() =>
				new InferredEmailConfidenceScorer({
					...CONFIG,
					weights: {
						domainWeight: 20,
						patternWeight: 20,
						smtpWeight: 20,
					},
				}),
		).toThrow("Weights do not add to a total of 100");
	});

	test("normalizes percentage weights before scoring", () => {
		const result = scoreWith(
			{
				passingScore: 0,
				weights: { domainWeight: 100, patternWeight: 0, smtpWeight: 0 },
			},
			createCandidate({ domainConfidence: 50 }),
		);

		expect(result).toMatchObject({ success: true, confidence: 25 });
	});

	test("returns no results for an empty candidate list", () => {
		const scorer = new InferredEmailConfidenceScorer(CONFIG);

		expect(scorer.scoreCandidates([], new Map())).toEqual([]);
	});

	test("combines domain and SMTP contributions using their weights", () => {
		const result = scoreWith(
			{
				passingScore: 75,
				weights: { domainWeight: 0.5, patternWeight: 0, smtpWeight: 0.5 },
			},
			createCandidate({ catchAll: "catch-all" }),
			new Map(),
		);

		expect(result).toEqual({
			success: true,
			confidence: 75,
			catchAll: "catch-all",
			pattern: EmailPattern.FirstNameDotLastName,
			inferredEmail: "alice.smith@example.com",
		});
	});

	test("rounds a fractional aggregate score up", () => {
		const result = scoreWith(
			{
				passingScore: 31,
				weights: { domainWeight: 1, patternWeight: 0, smtpWeight: 0 },
			},
			createCandidate({ domainConfidence: 55 }),
		);

		expect(result).toMatchObject({ success: true, confidence: 31 });
	});

	test.each([
		[-25, 0],
		[50, 25],
		[125, 100],
	])(
		"clamps domain confidence %s before applying its exponent",
		(input, expected) => {
			const result = scoreWith(
				{
					passingScore: 0,
					weights: { domainWeight: 1, patternWeight: 0, smtpWeight: 0 },
				},
				createCandidate({ domainConfidence: input }),
			);

			expect(result).toMatchObject({ success: true, confidence: expected });
		},
	);

	test.each([
		["rejected", 0],
		["retryable", 0],
		["error", 0],
		["unknown", 0],
		["accepted", 50],
	] as const)(
		"scores SMTP status %s as %s with catch-all status fixed at catch-all",
		(status, expected) => {
			const result = scoreWith(
				{
					passingScore: 0,
					weights: { domainWeight: 0, patternWeight: 0, smtpWeight: 1 },
				},
				createCandidate({
					catchAll: "catch-all",
					smtpVerificationResult: { status, message: "result" },
				}),
			);

			expect(result).toMatchObject({ success: true, confidence: expected });
		},
	);

	test.each([
		["not-catch-all", 100],
		["catch-all", 50],
		["unknown", 65],
		["conflicting", 65],
	] as const)(
		"applies the %s catch-all SMTP contribution",
		(catchAll, expected) => {
			const result = scoreWith(
				{
					passingScore: 0,
					weights: { domainWeight: 0, patternWeight: 0, smtpWeight: 1 },
				},
				createCandidate({ catchAll }),
			);

			expect(result).toMatchObject({ success: true, confidence: expected });
		},
	);

	test("returns zero pattern contribution when the frequency map is empty", () => {
		const result = scoreWith(
			{
				passingScore: 0,
				weights: { domainWeight: 0, patternWeight: 1, smtpWeight: 0 },
			},
			createCandidate(),
			new Map(),
		);

		expect(result).toMatchObject({ success: true, confidence: 0 });
	});

	test("returns zero pattern contribution when the candidate pattern is absent", () => {
		const result = scoreWith(
			{
				passingScore: 0,
				weights: { domainWeight: 0, patternWeight: 1, smtpWeight: 0 },
			},
			createCandidate(),
			new Map([[EmailPattern.FirstName, 2]]),
		);

		expect(result).toMatchObject({ success: true, confidence: 0 });
	});

	test("uses a 3-of-4 pattern frequency in the final weighted score", () => {
		const result = scoreWith(
			{
				passingScore: 0,
				weights: {
					domainWeight: 0.205,
					patternWeight: 0.795,
					smtpWeight: 0,
				},
			},
			createCandidate({ domainConfidence: 100 }),
			new Map([
				[EmailPattern.FirstNameDotLastName, 3],
				[EmailPattern.FirstName, 1],
			]),
		);

		expect(result).toMatchObject({ success: true, confidence: 81 });
	});

	test("accepts a score equal to the passing threshold", () => {
		const result = scoreWith(
			{
				passingScore: 25,
				weights: { domainWeight: 1, patternWeight: 0, smtpWeight: 0 },
			},
			createCandidate({ domainConfidence: 50 }),
		);

		expect(result).toMatchObject({ success: true, confidence: 25 });
	});

	test("returns the configured failure reason below the passing threshold", () => {
		const result = scoreWith(
			{
				passingScore: 26,
				weights: { domainWeight: 1, patternWeight: 0, smtpWeight: 0 },
			},
			createCandidate({ domainConfidence: 50 }),
		);

		expect(result).toEqual({
			success: false,
			reason: "Inference failed to meet the passing score of 26",
		});
	});

	test("clamps a negative passing score to zero", () => {
		const result = scoreWith(
			{
				passingScore: -1,
				weights: { domainWeight: 1, patternWeight: 0, smtpWeight: 0 },
			},
			createCandidate({ domainConfidence: 0 }),
		);

		expect(result).toMatchObject({ success: true, confidence: 0 });
	});

	test("clamps a passing score above 100 to 100", () => {
		const result = scoreWith(
			{
				passingScore: 101,
				weights: { domainWeight: 1, patternWeight: 0, smtpWeight: 0 },
			},
			createCandidate({ domainConfidence: 0 }),
		);

		expect(result).toEqual({
			success: false,
			reason: "Inference failed to meet the passing score of 100",
		});
	});

	test("maps a conflicting catch-all result to unknown on success", () => {
		const result = scoreWith(
			{
				passingScore: 0,
				weights: { domainWeight: 1, patternWeight: 0, smtpWeight: 0 },
			},
			createCandidate({ catchAll: "conflicting" }),
		);

		expect(result).toMatchObject({ success: true, catchAll: "unknown" });
	});

	test("scores candidates independently while preserving their order", () => {
		const scorer = new InferredEmailConfidenceScorer({
			passingScore: 0,
			weights: { domainWeight: 1, patternWeight: 0, smtpWeight: 0 },
		});

		const results = scorer.scoreCandidates(
			[
				createCandidate({ email: "first@example.com", domainConfidence: 20 }),
				createCandidate({ email: "second@example.com", domainConfidence: 80 }),
			],
			new Map(),
		);

		expect(results).toEqual([
			{
				success: true,
				confidence: 5,
				catchAll: "not-catch-all",
				pattern: EmailPattern.FirstNameDotLastName,
				inferredEmail: "first@example.com",
			},
			{
				success: true,
				confidence: 65,
				catchAll: "not-catch-all",
				pattern: EmailPattern.FirstNameDotLastName,
				inferredEmail: "second@example.com",
			},
		]);
	});
});
