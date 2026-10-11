import axios from "axios";
import { SerperResponseSchema } from "./serperSchemas";
import { WebSearchResult } from "../../types";

export interface WebSearchClient {
	search(query: string): Promise<WebSearchResult[]>;
}

interface HttpClient {
	post(
		url: string,
		body: unknown,
		headers?: Record<string, string>,
	): Promise<unknown>;
}

const axiosHttpClient: HttpClient = {
	async post(url, body, headers) {
		const response = await axios.post(url, body, { headers });
		return response.data;
	},
};

export class SerperClient implements WebSearchClient {
	constructor(
		private readonly apiKey: string,
		private readonly httpClient = axiosHttpClient,
	) {}

	public async search(query: string): Promise<WebSearchResult[]> {
		try {
			const data = JSON.stringify({
				q: query,
			});

			const res = await this.httpClient.post(
				"https://google.serper.dev/search",
				data,
				{
					"X-API-KEY": this.apiKey,
					"Content-Type": "application/json",
				},
			);
			const parsedApiRes = SerperResponseSchema.parse(res);
			return parsedApiRes.organic;
		} catch (err: unknown) {
			throw new Error(
				`An error has occurred during web search: ${err instanceof Error ? err.message : "An unknown error has occurred"}`,
				{ cause: err },
			);
		}
	}
}
