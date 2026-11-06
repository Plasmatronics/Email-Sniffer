import { describe, test } from "vitest";
import { PlaywrightWebsiteFetcher } from "./PlaywrightWebsiteFetcher";
import { DEFAULT_WEBSITE_FETCHER_CONFIG } from "../index";

describe("PlaywrightWebsiteFetcher smoke tests", () => {
	test("fetches a live website and reports HTTP errors", async () => {
		const fetcher = await PlaywrightWebsiteFetcher.createFetcher({});

		try {
			const url = process.env.SMOKE_TEST_FETCH_URL ?? "";
			if (!url)
				throw new Error(
					"Missing configuration variable for SMOKE_TEST_FETCH_URL",
				);

			try {
				const result = await fetcher.fetch(url, {
					...DEFAULT_WEBSITE_FETCHER_CONFIG,
					timeout: 15000,
				});

				console.log("Successfully fetched:", url);
				console.log("Content type:", result.contentType);
				console.log("Bytes received:", result.data.byteLength);
			} catch (error) {
				console.error("Live fetch failed:", error);
				throw error;
			}
		} finally {
			await fetcher.close();
		}
	}, 30000);
});
