import { describe, expect, test } from "vitest";
import { TextChunker } from "./TextChunker";

const ECMASCRIPT_WHITESPACE = [
	["horizontal tab", "\u0009"],
	["line feed", "\u000A"],
	["vertical tab", "\u000B"],
	["form feed", "\u000C"],
	["carriage return", "\u000D"],
	["space", "\u0020"],
	["non-breaking space", "\u00A0"],
	["Ogham space mark", "\u1680"],
	["en quad", "\u2000"],
	["em quad", "\u2001"],
	["en space", "\u2002"],
	["em space", "\u2003"],
	["three-per-em space", "\u2004"],
	["four-per-em space", "\u2005"],
	["six-per-em space", "\u2006"],
	["figure space", "\u2007"],
	["punctuation space", "\u2008"],
	["thin space", "\u2009"],
	["hair space", "\u200A"],
	["line separator", "\u2028"],
	["paragraph separator", "\u2029"],
	["narrow non-breaking space", "\u202F"],
	["medium mathematical space", "\u205F"],
	["ideographic space", "\u3000"],
	["byte order mark", "\uFEFF"],
] as const;

describe("TextChunker", () => {
	test("returns no chunks for empty text", () => {
		const chunker = new TextChunker();

		const chunks = chunker.chunk("");

		expect(chunks).toEqual([]);
	});

	test("returns one chunk when text contains no whitespace", () => {
		const chunker = new TextChunker();

		const chunks = chunker.chunk("bob@example.com");

		expect(chunks).toEqual(["bob@example.com"]);
	});

	test.each(ECMASCRIPT_WHITESPACE)(
		"separates chunks around $0",
		(_, whitespace) => {
			const chunker = new TextChunker();

			const chunks = chunker.chunk(`first${whitespace}second`);

			expect(chunks).toEqual(["first", "second"]);
		},
	);

	test("returns no chunks for whitespace-only text", () => {
		const chunker = new TextChunker();
		const whitespaceOnlyText = ECMASCRIPT_WHITESPACE.map(
			([, whitespace]) => whitespace,
		).join("");

		const chunks = chunker.chunk(whitespaceOnlyText);

		expect(chunks).toEqual([]);
	});

	test("ignores leading and trailing whitespace", () => {
		const chunker = new TextChunker();

		const chunks = chunker.chunk(" \tfirst second\n");

		expect(chunks).toEqual(["first", "second"]);
	});

	test("treats consecutive mixed whitespace as one separator", () => {
		const chunker = new TextChunker();

		const chunks = chunker.chunk("first \t\r\n\u00A0\u2003second");

		expect(chunks).toEqual(["first", "second"]);
	});

	test("separates chunks around a CRLF sequence", () => {
		const chunker = new TextChunker();

		const chunks = chunker.chunk("first\r\nsecond");

		expect(chunks).toEqual(["first", "second"]);
	});

	test("preserves punctuation and symbols inside chunks", () => {
		const chunker = new TextChunker();

		const chunks = chunker.chunk("(first@example.com), second@example.org!");

		expect(chunks).toEqual(["(first@example.com),", "second@example.org!"]);
	});
});
