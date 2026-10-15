export const getUrlWeightFromKeywords = (
	keywords: string[],
	weightMap: Record<string, number>,
): number => {
	if (!keywords.length) return 0;
	const segments = keywords.map((keyword) => weightMap[keyword] ?? 0);

	return Math.max(...segments);
};
