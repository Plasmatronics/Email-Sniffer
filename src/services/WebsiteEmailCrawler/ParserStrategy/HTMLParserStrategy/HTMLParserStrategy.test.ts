import { describe, expect, test } from "vitest";
import { HTMLParserStrategy } from "./HTMLParserStrategy";

describe("HTMLParserStrategy", () => {
	test.each(["text/html", "TEXT/HTML", "text/html; charset=UTF-8"])(
		"supports the html content type %s",
		(contentType) => {
			const strategy = new HTMLParserStrategy();

			expect(strategy.supports(contentType)).toBe(true);
		},
	);

	test.each(["application/json", "application/pdf", "text/plain"])(
		"does not support the non-HTML content type %s",
		(contentType) => {
			const strategy = new HTMLParserStrategy();

			expect(strategy.supports(contentType)).toBe(false);
		},
	);

	test("extracts visible body text", async () => {
		const strategy = new HTMLParserStrategy();
		const content = Buffer.from(`
			<html>
				<head><title>Page title</title></head>
				<body><h1>Contact us</h1><p>jane@example.com</p></body>
			</html>
		`);

		const result = await strategy.parse(content);

		expect(result.text.trim()).toBe("Contact us\n\njane@example.com");
	});

	test("excludes non-visible element content from the text", async () => {
		const strategy = new HTMLParserStrategy();
		const content = Buffer.from(`
			<body>
				<p>Visible</p>
				<script>script@example.com</script>
				<style>.email::after { content: "style@example.com"; }</style>
				<noscript>noscript@example.com</noscript>
				<template>template@example.com</template>
				<svg><text>svg@example.com</text></svg>
			</body>
		`);

		const result = await strategy.parse(content);

		expect(result.text.trim()).toBe("Visible");
	});

	test("extracts absolute, relative, and mailto links in document order", async () => {
		const strategy = new HTMLParserStrategy();
		const content = Buffer.from(`
			<body>
				<a href="https://example.com/contact">Contact</a>
				<a href="/about">About</a>
				<a href="mailto:jane@example.com">Email</a>
			</body>
		`);

		const result = await strategy.parse(content);

		expect(result.links).toEqual([
			"https://example.com/contact",
			"/about",
			"mailto:jane@example.com",
		]);
		expect(result.text).toContain("Email jane@example.com");
	});

	test("ignores anchors without an href attribute", async () => {
		const strategy = new HTMLParserStrategy();
		const content = Buffer.from(`
			<body>
				<a>Missing href</a>
				<a href="/contact">Contact</a>
			</body>
		`);

		const result = await strategy.parse(content);

		expect(result.links).toEqual(["/contact"]);
	});

	test("parses malformed HTML", async () => {
		const strategy = new HTMLParserStrategy();
		const content = Buffer.from(
			'<body><p>Contact jane@example.com<a href="/contact">Contact',
		);

		const result = await strategy.parse(content);

		expect(result).toEqual({
			text: "\nContact jane@example.com\nContact\n\n",
			links: ["/contact"],
		});
	});

	test("returns empty results for empty content", async () => {
		const strategy = new HTMLParserStrategy();

		const result = await strategy.parse(Buffer.alloc(0));

		expect(result).toEqual({ text: "", links: [] });
	});
});
