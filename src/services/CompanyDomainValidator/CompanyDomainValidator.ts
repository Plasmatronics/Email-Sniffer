import { getDomainWithoutSuffix, getFullDomain } from "tldts";
import {
	DomainValidatorConfig,
	UnverifiedDomainData,
	VerificationResult,
	VerifiedDomainData,
} from "./CompanyDomainValidator.types";
import { TRUSTED_PAGE_PATHS } from "./trustedPagePaths";
import { getKeywordsFromUrl, getUrlWeightFromKeywords } from "../../utils";

const DEFAULT_DOMAIN_VALIDATOR_CONFIG = {
	substringMatchPassThreshold: 50,
	overallPassThreshold: 65,
	overallFailMaximum: 20,
};

const MIN_ALLOWABLE_DOMAIN_LENGTH = 3;
export const SUBSTRING_MATCH_CONFIDENCE_INCREASE = 25;
const PERFECT_OVERLAP = 100;
export const FOUND_ON_COMPANY_PAGE_MIN_SCORE = 15;

export class CompanyDomainValidator {
	constructor(
		private domainValidatorConfig: DomainValidatorConfig = DEFAULT_DOMAIN_VALIDATOR_CONFIG,
	) {}

	validateDomain(
		unverifiedDomainData: UnverifiedDomainData,
		companyUrl: string,
	): VerifiedDomainData {
		let confidence = 0;
		confidence = this.validateDomainSource(
			confidence,
			unverifiedDomainData,
			companyUrl,
		);
		confidence = this.validateSubstringMatch(
			confidence,
			unverifiedDomainData,
			companyUrl,
		);

		return {
			confidence: confidence,
			verificationResult: this.getVerificationResult(confidence),
			domain: unverifiedDomainData.domain,
		};
	}

	private getVerificationResult(confidence: number): VerificationResult {
		if (confidence >= this.domainValidatorConfig.overallPassThreshold)
			return VerificationResult.Pass;
		else if (confidence <= this.domainValidatorConfig.overallFailMaximum)
			return VerificationResult.Fail;
		else return VerificationResult.Uncertain;
	}

	private updateConfidence(confidence: number, amount: number): number {
		return Math.min(Math.max(0, confidence + amount), 100);
	}

	private validateDomainSource(
		confidence: number,
		unverifiedDomainData: UnverifiedDomainData,
		companyUrl: string,
	): number {
		const normalizedSourceUrl = this.normalizeUrlToDomain(
			unverifiedDomainData.source,
		);
		const normalizedCompanyUrl = this.normalizeUrlToDomain(companyUrl);
		if (!normalizedSourceUrl || !normalizedCompanyUrl) {
			if (!normalizedSourceUrl)
				console.warn(
					`Could not extract domain from source URL: "${normalizedSourceUrl}".`,
				);
			if (!normalizedCompanyUrl)
				console.warn(
					`Could not extract domain from company URL: "${normalizedCompanyUrl}".`,
				);
			return 0;
		}

		let addedConfidence = 0;
		if (normalizedCompanyUrl === normalizedSourceUrl)
			addedConfidence += this.getUrlConfidenceScore(
				unverifiedDomainData.source,
			);

		return this.updateConfidence(confidence, addedConfidence);
	}

	private getUrlConfidenceScore(url: string): number {
		try {
			const keywords = getKeywordsFromUrl(url);
			const urlConfidenceScore = getUrlWeightFromKeywords(
				keywords,
				TRUSTED_PAGE_PATHS,
			);

			return Math.max(FOUND_ON_COMPANY_PAGE_MIN_SCORE, urlConfidenceScore);
		} catch (err: unknown) {
			console.warn(
				`Failed to get URL confidence score for ${url}: ${err instanceof Error ? err.message : "An unknown error occurred."}`,
			);

			return 0;
		}
	}

	private validateSubstringMatch(
		confidence: number,
		unverifiedDomainData: UnverifiedDomainData,
		companyUrl: string,
	): number {
		const companyUrlOriginal = this.normalizeUrlToDomain(companyUrl);
		const unverifiedDomainOriginal = unverifiedDomainData.domain;
		if (!companyUrlOriginal) {
			console.warn(
				`Could not extract domain from company URL: "${companyUrlOriginal}".`,
			);

			return 0;
		}

		const companyUrlSLD = this.extractSecondLevelDomain(companyUrlOriginal);
		const unverifiedSLD = this.extractSecondLevelDomain(
			unverifiedDomainOriginal,
		);

		if (!companyUrlSLD || !unverifiedSLD) {
			if (!companyUrlSLD)
				console.warn(
					`Could not extract second-level domain from company URL: "${companyUrlOriginal}".`,
				);
			if (!unverifiedSLD)
				console.warn(
					`Could not extract second-level domain from unverified domain: "${unverifiedDomainOriginal}".`,
				);
			return 0;
		}

		const shorterStr =
			companyUrlSLD.length > unverifiedSLD.length
				? unverifiedSLD
				: companyUrlSLD;
		const longerStr =
			companyUrlSLD.length > unverifiedSLD.length
				? companyUrlSLD
				: unverifiedSLD;
		if (shorterStr.length < MIN_ALLOWABLE_DOMAIN_LENGTH) {
			return shorterStr === longerStr
				? this.updateConfidence(confidence, PERFECT_OVERLAP)
				: confidence;
		}

		const overlapPercentage = this.findOverlapPercentage(shorterStr, longerStr);

		if (overlapPercentage === PERFECT_OVERLAP)
			return this.updateConfidence(confidence, 100);
		else if (
			overlapPercentage >=
			this.domainValidatorConfig.substringMatchPassThreshold
		)
			return this.updateConfidence(
				confidence,
				SUBSTRING_MATCH_CONFIDENCE_INCREASE,
			);
		else return confidence;
	}

	private findOverlapPercentage(shorterStr: string, longerStr: string): number {
		const cache: Record<string, number> = {};
		let maxOverlap = 0;

		const dfs = (shortCursor: number, longCursor: number): number => {
			if (shortCursor === shorterStr.length || longCursor === longerStr.length)
				return 0;

			const key = `${shortCursor}-${longCursor}`;
			if (key in cache) return cache[key]!;

			let curOverlap = 0;

			if (shorterStr[shortCursor] === longerStr[longCursor])
				curOverlap = 1 + dfs(shortCursor + 1, longCursor + 1);

			maxOverlap = Math.max(maxOverlap, curOverlap);
			cache[key] = curOverlap;

			return curOverlap;
		};

		for (let shortCursor = 0; shortCursor < shorterStr.length; shortCursor++) {
			for (let longCursor = 0; longCursor < longerStr.length; longCursor++) {
				dfs(shortCursor, longCursor);
			}
		}

		return (maxOverlap / longerStr.length) * 100;
	}

	private extractSecondLevelDomain(domain: string): string {
		const parsedSLD = getDomainWithoutSuffix(domain);
		if (!parsedSLD) return "";

		return parsedSLD;
	}

	private normalizeUrlToDomain(url: string): string {
		const parsedDomain = getFullDomain(url);
		if (!parsedDomain) return "";

		return parsedDomain;
	}
}
