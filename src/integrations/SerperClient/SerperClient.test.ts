import axios, { type AxiosResponse } from "axios";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { SerperClient } from "./SerperClient";

const apiResponse = {
	organic: [
		{
			title: "Wonder",
			link: "https://wonder.com/",
			snippet: "Wonder's official website.",
			position: 1,
		},
	],
	peopleAlsoAsk: [],
	relatedSearches: [],
};

describe("SerperClient", () => {
	const post = vi.spyOn(axios, "post");
	const head = vi.spyOn(axios, "head");

	beforeEach(() => {
		post.mockReset();
		post.mockResolvedValue({ data: apiResponse } as AxiosResponse);
		head.mockReset();
		head.mockResolvedValue({ status: 204 } as AxiosResponse);
	});

	test("sends the query and API key to Serper", async () => {
		const client = new SerperClient("test-api-key");

		await client.search("OpenAI");

		expect(post).toHaveBeenCalledWith(
			"https://google.serper.dev/search",
			{ q: "OpenAI" },
			{
				headers: {
					"X-API-KEY": "test-api-key",
					"Content-Type": "application/json",
				},
			},
		);
	});

	test("returns validated organic search results", async () => {
		const client = new SerperClient("test-api-key");

		await expect(client.search("Wonder")).resolves.toEqual(apiResponse.organic);
	});

	test("rejects a malformed API response", async () => {
		post.mockResolvedValue({
			data: {
				...apiResponse,
				organic: [{ link: "https://wonder.com/", position: 1 }],
			},
		} as AxiosResponse);
		const client = new SerperClient("test-api-key");

		await expect(client.search("Wonder")).rejects.toThrow(
			"An error has occurred during web search",
		);
	});

	test("reports HTTP failures", async () => {
		post.mockRejectedValue(new Error("request failed"));
		const client = new SerperClient("test-api-key");

		await expect(client.search("Wonder")).rejects.toThrow(
			"An error has occurred during web search: request failed",
		);
	});

	test("reports a healthy connectivity check", async () => {
		const client = new SerperClient("test-api-key");

		await expect(client.healthCheck()).resolves.toMatchObject({
			isHealthy: true,
			service: "SerperClient",
		});
		expect(head).toHaveBeenCalledWith(
			"https://connectivitycheck.gstatic.com/generate_204",
			expect.objectContaining({ signal: expect.any(AbortSignal) }),
		);
	});

	test("reports an unhealthy connectivity check when the request fails", async () => {
		head.mockRejectedValue(new Error("request failed"));
		const client = new SerperClient("test-api-key");

		await expect(client.healthCheck()).resolves.toMatchObject({
			isHealthy: false,
			service: "SerperClient",
			message:
				"An error occurred while health testing SerperClient: request failed",
		});
	});

	test("reports an unhealthy connectivity check for an unexpected status", async () => {
		head.mockResolvedValue({ status: 200 });
		const client = new SerperClient("test-api-key");

		await expect(client.healthCheck()).resolves.toMatchObject({
			isHealthy: false,
			message:
				"An error occurred while health testing SerperClient: Unexpected connectivity response: 200",
		});
	});
});
