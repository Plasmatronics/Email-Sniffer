import { describe, expect, test } from "vitest";
import { PDFParserStrategy } from "./PDFParserStrategy";

function createPdfFixture(): Buffer {
	const contentStream =
		"BT /F1 12 Tf 72 720 Td (Contact jane@example.com) Tj ET";
	const objects = [
		"<< /Type /Catalog /Pages 2 0 R >>",
		"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
		"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R /Annots [6 0 R] >>",
		"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
		`<< /Length ${Buffer.byteLength(contentStream)} >>\nstream\n${contentStream}\nendstream`,
		"<< /Type /Annot /Subtype /Link /Rect [72 700 240 725] /Border [0 0 0] /A << /S /URI /URI (https://example.com/contact) >> >>",
	];
	let pdf = "%PDF-1.4\n";
	const offsets = objects.map((object, index) => {
		const offset = Buffer.byteLength(pdf);
		pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
		return offset;
	});
	const xrefOffset = Buffer.byteLength(pdf);
	const xrefEntries = offsets
		.map((offset) => `${offset.toString().padStart(10, "0")} 00000 n `)
		.join("\n");

	pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${xrefEntries}\n`;
	pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n`;
	pdf += `startxref\n${xrefOffset}\n%%EOF`;

	return Buffer.from(pdf);
}

describe("PDFParserStrategy integration", () => {
	test("extracts text and embedded links from a real PDF", async () => {
		const strategy = new PDFParserStrategy();

		const result = await strategy.parse(createPdfFixture());

		expect(result.text).toContain("Contact jane@example.com");
		expect(result.links).toEqual(["https://example.com/contact"]);
	});
});
