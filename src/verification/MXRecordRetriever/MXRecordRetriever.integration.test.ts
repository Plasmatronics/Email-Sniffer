import { describe, expect, test } from "vitest";
import {
	MIN_RECORDS,
	MXRecordRetriever,
	NUM_RECORDS_DEFAULT,
} from "./MXRecordRetriever.ts";

describe("MXRecordRetriever integration", () => {
	test("resolves live MX records for a mail-enabled domain", async () => {
		const retriever = new MXRecordRetriever();

		const records = await retriever.findMXRecords("user@gmail.com");

		expect(records.length).toBeGreaterThanOrEqual(MIN_RECORDS);
		expect(records.length).toBeLessThanOrEqual(NUM_RECORDS_DEFAULT);
		expect(records.every((record) => record.length > 0)).toBe(true);
	});

	test("returns no records for a domain that publishes a null MX record", async () => {
		const retriever = new MXRecordRetriever();

		await expect(
			retriever.findMXRecords(
				"user@thisIsASuperObviouslyFakeDomainNameForEmailSniffersIntegreationTest.com",
			),
		).resolves.toEqual([]);
	});
});
