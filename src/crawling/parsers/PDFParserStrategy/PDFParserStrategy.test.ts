import { beforeEach, describe, expect, test, vi } from "vitest";
import { PDFParserStrategy } from "./PDFParserStrategy";

const { destroy, getInfo, getText, PDFParse } = vi.hoisted(() => ({
	destroy: vi.fn(),
	getInfo: vi.fn(),
	getText: vi.fn(),
	PDFParse: vi.fn(),
}));

vi.mock("pdf-parse", () => ({ PDFParse }));

describe("PDFParserStrategy", () => {
	beforeEach(() => {
		vi.resetAllMocks();
		PDFParse.mockImplementation(function () {
			return { destroy, getInfo, getText };
		});
		destroy.mockResolvedValue(undefined);
		getInfo.mockResolvedValue({ pages: [] });
		getText.mockResolvedValue({ text: "" });
	});

	test.each([
		"application/pdf",
		"APPLICATION/PDF",
		"application/pdf; charset=binary",
	])("supports the PDF content type %s", (contentType) => {
		const strategy = new PDFParserStrategy();

		expect(strategy.supports(contentType)).toBe(true);
	});

	test.each(["text/html", "application/json", "application/pdfx"])(
		"does not support the non-PDF content type %s",
		(contentType) => {
			const strategy = new PDFParserStrategy();

			expect(strategy.supports(contentType)).toBe(false);
		},
	);

	test("extracts text and links from a PDF", async () => {
		const strategy = new PDFParserStrategy();
		getText.mockResolvedValue({ text: "Contact jane@example.com" });
		getInfo.mockResolvedValue({
			pages: [
				{
					links: [{ url: "https://example.com/contact" }],
				},
				{
					links: [{ url: "mailto:jane@example.com" }],
				},
			],
		});

		const result = await strategy.parse(Buffer.from("pdf content"));

		expect(result).toEqual({
			text: "Contact jane@example.com",
			links: ["https://example.com/contact", "mailto:jane@example.com"],
		});
	});

	test("passes the PDF buffer to the parser", async () => {
		const strategy = new PDFParserStrategy();
		const content = Buffer.from("pdf content");

		await strategy.parse(content);

		expect(PDFParse).toHaveBeenCalledWith({ data: content });
	});

	test("requests page link information", async () => {
		const strategy = new PDFParserStrategy();

		await strategy.parse(Buffer.from("pdf content"));

		expect(getInfo).toHaveBeenCalledWith({ parsePageInfo: true });
	});

	test("destroys the parser after parsing succeeds", async () => {
		const strategy = new PDFParserStrategy();

		await strategy.parse(Buffer.from("pdf content"));

		expect(destroy).toHaveBeenCalledOnce();
	});

	test("destroys the parser after parsing fails", async () => {
		const strategy = new PDFParserStrategy();
		getText.mockRejectedValue(new Error("Invalid PDF"));

		await expect(strategy.parse(Buffer.from("invalid"))).rejects.toThrow(
			"Invalid PDF",
		);
		expect(destroy).toHaveBeenCalledOnce();
	});
});
