import { describe, expect, test } from "vitest";
import { SerperClient } from "../../integrations";
import { WebSearcher } from "./WebSearcher";

const apiKey = process.env.SERPER_API_KEY;

describe("WebSearcher integration", () => {
	test("returns live results from its search strategies", async () => {
		if (!apiKey) throw new Error("SERPER_API_KEY is required");
		const searcher = new WebSearcher(new SerperClient(apiKey));

		const results = await searcher.fetchResults("Obama Foundation");

		expect(results.length).toBeGreaterThan(0);
	});
});
