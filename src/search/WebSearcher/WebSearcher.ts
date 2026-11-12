import { logger } from "../../infrastructure";
import { WebSearchClient } from "../../integrations";
import { WebSearchResult } from "../../types";

const QUERY_ADDONS = ["filetype:pdf", "contact"];

export class WebSearcher {
	private readonly serviceName = "WebSearcher";

	constructor(private readonly webSearchClient: WebSearchClient) {}

	private createSearchQueries(baseQuery: string): string[] {
		return QUERY_ADDONS.map((addOn) => `${baseQuery} ${addOn}`);
	}

	public async fetchResults(baseQuery: string): Promise<WebSearchResult[]> {
		const startTime = Date.now();
		const childLogger = logger.child({
			serviceName: this.serviceName,
			baseQuery,
		});

		try {
			childLogger.debug("Fetching search results");

			const queries = this.createSearchQueries(baseQuery);
			const searchResults = await Promise.allSettled(
				queries.map((query) => this.webSearchClient.search(query)),
			);

			const successfulSearchResults = searchResults.flatMap((result) =>
				result.status === "fulfilled" ? result.value : [],
			);
			const failedResults = searchResults.filter(
				(result): result is PromiseRejectedResult =>
					result.status === "rejected",
			);

			if (failedResults.length === searchResults.length) {
				const failedReasons = [
					...new Set(
						failedResults.map((result) =>
							result.reason instanceof Error
								? result.reason.message
								: String(result.reason),
						),
					),
				].join("\n");

				throw new Error(
					`Could not retrieve any search results: ${failedReasons}`,
				);
			}

			for (const result of searchResults) {
				if (result.status === "rejected")
					childLogger.warn({ err: result.reason }, "Search request failed");
			}

			childLogger.debug(
				{
					results: successfulSearchResults.length,
					durationMs: Date.now() - startTime,
				},
				"Search results fetched",
			);
			return successfulSearchResults;
		} catch (err: unknown) {
			childLogger.error(
				{ err, durationMs: Date.now() - startTime },
				"Failed to fetch results",
			);
			return [];
		}
	}
}
