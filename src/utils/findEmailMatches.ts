export const findEmailMatches = (matchable: string): string[] => {
	const emailRegex = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
	return matchable.match(emailRegex) ?? [];
};
