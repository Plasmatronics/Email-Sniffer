const DELIMITERS = new Set(["-", "_", "/", "."]);

export const getKeywordsFromUrl = (baseUrl: string): string[] => {
	let pathName: string;
	try {
		const { pathname: parsedPathName } = new URL(baseUrl);
		pathName = parsedPathName;
	} catch (err) {
		throw new Error(
			`${err instanceof Error ? err.message : `${baseUrl} is not a valid domain name.`}`,
			{ cause: err },
		);
	}

	const allKeywords: string[] = [];
	let curWord: string[] = [];

	for (const char of pathName) {
		if (DELIMITERS.has(char)) {
			allKeywords.push(curWord.join("").toLowerCase());
			curWord = [];
		} else curWord.push(char);
	}
	if (curWord.length) allKeywords.push(curWord.join(""));

	return allKeywords;
};
