import dns from "node:dns/promises";
import type { MxRecord } from "node:dns";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { MXRecordRetriever } from "./MXRecordRetriever.ts";

vi.mock("node:dns/promises", () => ({
	default: {
		resolveMx: vi.fn(),
	},
}));

const resolveMx = vi.mocked(dns.resolveMx);
const mxRecords: MxRecord[] = [
	{ exchange: "mx-6.example.com", priority: 60 },
	{ exchange: "mx-1.example.com", priority: 10 },
	{ exchange: "mx-4.example.com", priority: 40 },
	{ exchange: "mx-2.example.com", priority: 20 },
	{ exchange: "mx-5.example.com", priority: 50 },
	{ exchange: "mx-3.example.com", priority: 30 },
];

describe("MXRecordRetriever", () => {
	beforeEach(() => {
		resolveMx.mockReset();
		resolveMx.mockResolvedValue(mxRecords);
	});

	test("returns an empty array for an invalid domain", async () => {
		const retriever = new MXRecordRetriever();

		const res = await retriever.findMXRecords("not-an-email");
		expect(res).toEqual([]);
	});

	test("queries MX records for the recipient domain", async () => {
		const retriever = new MXRecordRetriever();

		await retriever.findMXRecords("user@example.com");

		expect(resolveMx).toHaveBeenCalledWith("example.com");
	});

	test("returns MX records in ascending priority order", async () => {
		const retriever = new MXRecordRetriever(3);

		await expect(retriever.findMXRecords("user@example.com")).resolves.toEqual([
			"mx-1.example.com",
			"mx-2.example.com",
			"mx-3.example.com",
		]);
	});

	test.each([
		{ label: "the default", maxRecords: undefined, expectedCount: 3 },
		{ label: "zero", maxRecords: 0, expectedCount: 1 },
		{ label: "a negative value", maxRecords: -10, expectedCount: 1 },
		{ label: "a fractional value", maxRecords: 2.9, expectedCount: 2 },
		{ label: "NaN", maxRecords: Number.NaN, expectedCount: 3 },
		{ label: "positive infinity", maxRecords: Infinity, expectedCount: 5 },
		{ label: "negative infinity", maxRecords: -Infinity, expectedCount: 1 },
		{ label: "a value above the maximum", maxRecords: 10, expectedCount: 5 },
	])("normalizes $label record cap", async ({ maxRecords, expectedCount }) => {
		const retriever = new MXRecordRetriever(maxRecords);

		const records = await retriever.findMXRecords("user@example.com");

		expect(records).toHaveLength(expectedCount);
	});

	test("returns every available record when fewer exist than requested", async () => {
		resolveMx.mockResolvedValue(mxRecords.slice(0, 2));
		const retriever = new MXRecordRetriever(5);

		const records = await retriever.findMXRecords("user@example.com");

		expect(records).toHaveLength(2);
	});

	test("returns an empty array for an empty MX response", async () => {
		resolveMx.mockResolvedValue([]);
		const retriever = new MXRecordRetriever();

		await expect(retriever.findMXRecords("user@example.com")).resolves.toEqual(
			[],
		);
	});

	test.each([
		{ label: "root-label exchange", exchange: "." },
		{ label: "empty exchange returned by Node DNS", exchange: "" },
	])(
		"returns an empty array for a null MX response with $label",
		async ({ exchange }) => {
			resolveMx.mockResolvedValue([{ exchange, priority: 0 }]);
			const retriever = new MXRecordRetriever();

			await expect(
				retriever.findMXRecords("user@example.com"),
			).resolves.toEqual([]);
		},
	);

	test.each(["EBADNAME", "ENODATA", "ENOTFOUND"])(
		"returns an empty array for DNS error %s",
		async (code) => {
			resolveMx.mockRejectedValue(
				Object.assign(new Error("DNS lookup failed"), { code }),
			);
			const retriever = new MXRecordRetriever();

			await expect(
				retriever.findMXRecords("user@example.com"),
			).resolves.toEqual([]);
		},
	);

	test("propagates DNS resolver failures", async () => {
		const dnsError = new Error("DNS lookup failed");
		resolveMx.mockRejectedValue(dnsError);
		const retriever = new MXRecordRetriever();

		await expect(retriever.findMXRecords("user@example.com")).rejects.toBe(
			dnsError,
		);
	});
});
