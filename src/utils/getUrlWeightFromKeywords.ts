export const getUrlWeightFromKeywords = (
	keywords: string[],
	weightMap: Record<string, number>,
): number => {
	if (!keywords.length) throw new Error("Enter keywords to obtain weights");
	const segments = keywords.map((keyword) => weightMap[keyword] ?? 0);

	return Math.max(...segments);
};
