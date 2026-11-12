import { describe, expect, test } from "vitest";
import { SerperClient } from "./SerperClient";

const apiKey = process.env.SERPER_API_KEY;

describe("SerperClient integration", () => {
	test("returns live organic search results", async () => {
		if (!apiKey) throw new Error("SERPER_API_KEY is required");
		const client = new SerperClient(apiKey);

		// Does not allow @SLD.com.
		await expect(client.search("@obama.com")).rejects.toThrow();

		// Allows @SLD and SLD.com independently.
		expect((await client.search("@obama filetype:pdf")).length).toBeGreaterThan(
			0,
		);
		expect(
			(await client.search("obama.com filetype:pdf")).length,
		).toBeGreaterThan(0);
	});
});
