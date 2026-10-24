import z from "zod";

export const validateEmail = (email: string): boolean => {
	return z.email().safeParse(email).success;
};

export const extractDomain = (email: string): string => {
	if (!validateEmail(email)) return "";

	const atIndex = email.indexOf("@");
	return email.slice(atIndex + 1);
};
