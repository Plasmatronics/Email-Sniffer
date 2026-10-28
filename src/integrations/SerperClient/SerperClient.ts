import axios from "axios";
import { SerperResponseSchema } from "./serperSchemas";
import { HealthCheck, SnifferIntegration, WebSearchResult } from "../../types";

export interface WebSearchClient {
	search(query: string): Promise<WebSearchResult[]>;
}

//20 searches supported per given query
export class SerperClient implements WebSearchClient, SnifferIntegration {
	private readonly service = "SerperClient";

	constructor(private readonly apiKey: string) {}

	async search(query: string): Promise<WebSearchResult[]> {
		try {
			const data = {
				q: query,
			};

			const response = await axios.post(
				"https://google.serper.dev/search",
				data,
				{
					headers: {
						"X-API-KEY": this.apiKey,
						"Content-Type": "application/json",
					},
				},
			);
			const parsedApiRes = SerperResponseSchema.parse(response.data);
			return parsedApiRes.organic;
		} catch (err: unknown) {
			throw new Error(
				`An error has occurred during web search: ${err instanceof Error ? err.message : "An unknown error has occurred"}`,
				{ cause: err },
			);
		}
	}

	async healthCheck(): Promise<HealthCheck> {
		const startTime = Date.now();
		try {
			const response = await axios.head(
				"https://connectivitycheck.gstatic.com/generate_204",
				{
					signal: AbortSignal.timeout(3000),
				},
			);

			if (response.status !== 204)
				throw new Error(`Unexpected connectivity response: ${response.status}`);

			return {
				isHealthy: true,
				requestTime: Date.now() - startTime,
				service: this.service,
			};
		} catch (err: unknown) {
			return {
				isHealthy: false,
				requestTime: Date.now() - startTime,
				service: this.service,
				message: `An error occurred while health testing ${this.service}: ${err instanceof Error ? err.message : "Unable to connect to the internet"}`,
			};
		}
	}
}
