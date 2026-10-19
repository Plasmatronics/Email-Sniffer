const NON_WHITESPACE_REGEX = /\S+/g;

export class TextChunker {
	chunk(text: string): string[] {
		return (text.match(NON_WHITESPACE_REGEX) ?? []).map((wordMatch) =>
			wordMatch.toString(),
		);
	}
}
