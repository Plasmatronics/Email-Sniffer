import z from "zod";
import { getDomain } from "tldts";

export const validateEmail = (email: string): boolean => {
	return z.email().safeParse(email).success;
};

export const extractDomain = (emailOrUrl: string): string => {
	if (validateEmail(emailOrUrl)) {
		const atIndex = emailOrUrl.indexOf("@");
		return emailOrUrl.slice(atIndex + 1).toLowerCase();
	}

	return getDomain(emailOrUrl)?.toLowerCase() ?? "";
};
