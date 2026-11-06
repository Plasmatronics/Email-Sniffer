import { extractDomain } from "./email";

export const normalizeCompanyURL = (url: string): string => {
	try {
		const domain = extractDomain(url);
		if (!domain) return "";

		const normalizedURL = new URL(`https://${domain}`);
		return normalizedURL.href;
	} catch {
		return "";
	}
};
