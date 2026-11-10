import { logger } from "../../infrastructure";
import { WebSearchClient } from "../../integrations";
import { WebSearchResult } from "../../types";

const QUERY_ADDONS = ["filetype:pdf", "contact"];

export class WebSearcher {
	constructor(private readonly webSearchClient: WebSearchClient) {}

	private createSearchQueries(baseQuery: string): string[] {
		return QUERY_ADDONS.map((addOn) => `${baseQuery} ${addOn}`);
	}

	public async fetchResults(baseQuery: string): Promise<WebSearchResult[]> {
		const childLogger = logger.child({ baseQuery });

		try {
			childLogger.debug("Fetching search results");

			const queries = this.createSearchQueries(baseQuery);
			const searchResults = await Promise.allSettled(
				queries.map((query) => this.webSearchClient.search(query)),
			);

			const successfulSearchResults = searchResults.flatMap((result) =>
				result.status === "fulfilled" ? result.value : [],
			);
			if (!successfulSearchResults.length)
				throw new Error("Could not retrieve any search results");

			for (const result of searchResults) {
				if (result.status === "rejected")
					childLogger.warn({ err: result.reason }, "Search request failed");
			}

			return successfulSearchResults;
		} catch (err: unknown) {
			childLogger.error({ err }, "Failed to fetch results");
			return [];
		}
	}
}
