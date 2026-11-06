import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { DEFAULT_WEBSITE_FETCHER_CONFIG } from "../index";
import { PlaywrightWebsiteFetcher } from "./PlaywrightWebsiteFetcher";

describe("PlaywrightWebsiteFetcher integration", () => {
	let baseUrl: string;
	let server: Server;
	let fetcher: PlaywrightWebsiteFetcher;

	beforeAll(async () => {
		server = createServer((request, response) => {
			if (request.url === "/page") {
				response.setHeader("Content-Type", "text/html; charset=utf-8");
				response.end("<html><body><h1>Fetched page</h1></body></html>");
				return;
			}

			response.statusCode = 404;
			response.end("Not found");
		});

		await new Promise<void>((resolve) => {
			server.listen(0, "127.0.0.1", resolve);
		});
		baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
		fetcher = await PlaywrightWebsiteFetcher.createFetcher({});
	});

	afterAll(async () => {
		if (fetcher) {
			await fetcher.close();
		}
		await new Promise<void>((resolve, reject) => {
			server.close((error) => (error ? reject(error) : resolve()));
		});
	});

	test("fetches rendered HTML and content type from a local HTTP server", async () => {
		const result = await fetcher.fetch(`${baseUrl}/page`, {
			...DEFAULT_WEBSITE_FETCHER_CONFIG,
			timeout: 5_000,
		});

		expect(result.contentType).toBe("text/html; charset=utf-8");
		expect(result.data.toString()).toContain("Fetched page");
	});

	test("reports a local HTTP error", async () => {
		await expect(
			fetcher.fetch(`${baseUrl}/missing`, DEFAULT_WEBSITE_FETCHER_CONFIG),
		).rejects.toThrow(`HTTP 404 for ${baseUrl}/missing`);
	});
});
