import { getDomainWithoutSuffix } from "tldts";

export const getSecondLevelDomain = (domain: string): string => {
	const domainWithoutSuffix = getDomainWithoutSuffix(domain);
	if (!domainWithoutSuffix) return "";

	return domainWithoutSuffix;
};
