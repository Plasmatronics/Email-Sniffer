import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import { EmailExtractor } from "../EmailExtractor";
import { HTMLParserStrategy } from "./ParserStrategy";
import { WebsiteEmailCrawler } from "./WebsiteEmailCrawler";

describe("WebsiteEmailCrawler integration", () => {
	let baseUrl: string;
	let server: Server;

	beforeAll(async () => {
		server = createServer((request, response) => {
			response.setHeader("Content-Type", "text/html; charset=utf-8");

			switch (request.url) {
				case "/":
					response.end(`
						<body>
							<p>root@example.com</p>
							<a href="mailto:linked%40example.com">Email us</a>
							<a href="/contact#team">Contact</a>
							<a href="https://outside.example/about">Outside</a>
						</body>
					`);
					break;
				case "/contact":
					response.end("<body><p>contact@example.com</p></body>");
					break;
				case "/redirect":
					response.statusCode = 302;
					response.setHeader("Location", "/contact");
					response.end();
					break;
				default:
					response.statusCode = 404;
					response.end("<body>Not found</body>");
			}
		});

		await new Promise<void>((resolve) => {
			server.listen(0, "127.0.0.1", resolve);
		});
		const address = server.address() as AddressInfo;
		baseUrl = `http://127.0.0.1:${address.port}`;
	});

	afterAll(async () => {
		await new Promise<void>((resolve, reject) => {
			server.close((error) => (error ? reject(error) : resolve()));
		});
	});

	test("crawls same-origin HTML pages through the real service stack", async () => {
		const crawler = new WebsiteEmailCrawler(
			[new HTMLParserStrategy()],
			new EmailExtractor(),
			{ maxPages: 2 },
		);

		await expect(crawler.crawl(`${baseUrl}/`)).resolves.toEqual({
			[`${baseUrl}/`]: ["root@example.com", "linked@example.com"],
			[`${baseUrl}/contact`]: ["contact@example.com"],
		});
	});

	test("does not follow HTTP redirects", async () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		const crawler = new WebsiteEmailCrawler(
			[new HTMLParserStrategy()],
			new EmailExtractor(),
			{ maxPages: 1 },
		);

		await expect(crawler.crawl(`${baseUrl}/redirect`)).resolves.toEqual({});
		expect(warn).toHaveBeenCalledOnce();
	});
});
