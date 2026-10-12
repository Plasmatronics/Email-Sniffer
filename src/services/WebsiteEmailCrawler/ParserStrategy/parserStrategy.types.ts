export interface ParserStrategy {
	supports(contentType: string): boolean;
	parse(content: Buffer): Promise<ParsedResults>;
}

export interface ParsedResults {
	links: string[];
	text: string;
}
