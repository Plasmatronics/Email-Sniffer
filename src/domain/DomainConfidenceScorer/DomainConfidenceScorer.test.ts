import { afterEach, describe, expect, test, vi } from "vitest";
import {
	VerificationResult,
	type DomainConfidenceScorerConfig,
} from "./DomainConfidenceScorer.types";
import {
	DomainConfidenceScorer,
	FOUND_ON_COMPANY_PAGE_MIN_SCORE,
} from "./DomainConfidenceScorer";

const COMPANY_URL = "https://www.wonderlabs.com";

interface ScorerOptions {
	source?: string;
	domain?: string;
	companyUrl?: string;
	config?: DomainConfidenceScorerConfig;
}

describe("DomainConfidenceScorer", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	function createValidator({
		source = `${COMPANY_URL}/contact`,
		domain = "wonder.com",
		companyUrl = COMPANY_URL,
		config,
	}: ScorerOptions = {}) {
		const scorer = new DomainConfidenceScorer(config);

		return {
			validateDomain: () => scorer.validateDomain(source, domain, companyUrl),
		};
	}

	test("passes an exact company-domain match at maximum confidence", () => {
		const validator = createValidator({
			source: "https://unrelated.example/contact",
			domain: "wonderlabs.com",
		});

		expect(validator.validateDomain()).toEqual({
			confidence: 100,
			domain: "wonderlabs.com",
			verificationResult: VerificationResult.Pass,
		});
	});

	test("passes an exact match whose second-level domain is shorter than three characters", () => {
		const validator = createValidator({
			source: "https://unrelated.example/contact",
			domain: "x.co",
			companyUrl: "https://x.co",
		});

		expect(validator.validateDomain().confidence).toBe(100);
	});

	test("combines a trusted source-page score with a qualifying substring match", () => {
		const validator = createValidator();

		expect(validator.validateDomain()).toEqual({
			confidence: 75,
			domain: "wonder.com",
			verificationResult: VerificationResult.Pass,
		});
	});

	test("uses the minimum source score for the company homepage", () => {
		const validator = createValidator({
			source: COMPANY_URL,
			domain: "notAMatch.com",
			companyUrl: COMPANY_URL,
		});

		expect(validator.validateDomain().confidence).toBe(
			FOUND_ON_COMPANY_PAGE_MIN_SCORE,
		);
	});

	test("does not award source confidence for a different company's page", () => {
		const validator = createValidator({
			source: "https://unrelated.example/contact",
			domain: "notAMatch.com",
		});

		expect(validator.validateDomain().confidence).toBe(0);
	});

	test("preserves source confidence when the domains do not overlap enough", () => {
		const validator = createValidator({ domain: "acme.com" });

		expect(validator.validateDomain().confidence).toBe(50);
	});

	test("honors a custom substring-match threshold", () => {
		const validator = createValidator({
			source: "https://unrelated.example/contact",
			config: {
				substringMatchPassThreshold: 100,
				overallPassThreshold: 65,
				overallFailMaximum: 15,
			},
		});

		expect(validator.validateDomain().confidence).toBe(0);
	});

	test("honors a custom overall pass threshold", () => {
		const validator = createValidator({
			config: {
				substringMatchPassThreshold: 50,
				overallPassThreshold: 100,
				overallFailMaximum: 20,
			},
		});

		expect(validator.validateDomain().verificationResult).toBe(
			VerificationResult.Uncertain,
		);
	});

	test("honors a custom overall fail maximum", () => {
		const validator = createValidator({
			config: {
				substringMatchPassThreshold: 50,
				overallPassThreshold: 100,
				overallFailMaximum: 75,
			},
		});

		expect(validator.validateDomain().verificationResult).toBe(
			VerificationResult.Fail,
		);
	});

	test("supports domains with compound public suffixes", () => {
		const validator = createValidator({
			source: "https://unrelated.example/contact",
			domain: "wonderlabs.co.uk",
			companyUrl: "https://wonderlabs.co.uk",
		});

		expect(validator.validateDomain().confidence).toBe(100);
	});

	test("returns a failed validation result for an invalid candidate domain", () => {
		vi.spyOn(console, "warn").mockImplementation(() => {});
		const validator = createValidator({ domain: "not-a-domain" });

		expect(validator.validateDomain()).toEqual({
			confidence: 0,
			domain: "not-a-domain",
			verificationResult: VerificationResult.Fail,
		});
	});

	test("uses the greatest trusted-page weight across nested path segments", () => {
		const validator = createValidator({
			source: `${COMPANY_URL}/blog/contact`,
			domain: "unrelateddomain.com",
		});

		expect(validator.validateDomain().confidence).toBe(50);
	});

	test("uses the minimum source score for an unknown company-page path", () => {
		const validator = createValidator({
			source: `${COMPANY_URL}/products`,
			domain: "unrelateddomain.com",
		});

		expect(validator.validateDomain().confidence).toBe(
			FOUND_ON_COMPANY_PAGE_MIN_SCORE,
		);
	});

	test("does not award source confidence for a malformed source URL", () => {
		vi.spyOn(console, "warn").mockImplementation(() => {});
		const validator = createValidator({
			source: "not-a-valid-url",
			domain: "unrelateddomain.com",
		});

		expect(validator.validateDomain()).toEqual({
			confidence: 0,
			domain: "unrelateddomain.com",
			verificationResult: VerificationResult.Fail,
		});
	});

	test("returns a failed validation result for a malformed company URL", () => {
		vi.spyOn(console, "warn").mockImplementation(() => {});
		const validator = createValidator({ companyUrl: "not-a-valid-url" });

		expect(validator.validateDomain()).toEqual({
			confidence: 0,
			domain: "wonder.com",
			verificationResult: VerificationResult.Fail,
		});
	});

	test("properly returns result as uncertain in grey cases", () => {
		const validator = createValidator({
			source: "unrelateddomain.com",
		});

		const res = validator.validateDomain();

		expect(res.verificationResult).toEqual(VerificationResult.Uncertain);
	});

	test.each([
		["/contact", 50],
		["/privacy", 45],
		["/terms", 40],
		["/support", 35],
		["/blog", 15],
		["/company/contact", 50],
	])("scores source page %s correctly", (path, expected) => {
		const validator = createValidator({
			source: `${COMPANY_URL}${path}`,
			domain: "unrelateddomain.com",
		});

		expect(validator.validateDomain().confidence).toBe(expected);
	});
});
