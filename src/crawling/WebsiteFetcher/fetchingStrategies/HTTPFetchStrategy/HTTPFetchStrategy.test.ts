import type { BrowserContext } from "playwright";
import { describe, expect, test, vi } from "vitest";
import { HTTPFetchStrategy } from "./HTTPFetchStrategy";

const config = { maxContentLength: 1_000, timeout: 5_000 };

describe("HTTPFetchStrategy", () => {
	test("supports PDF URLs", () => {
		const strategy = new HTTPFetchStrategy({} as BrowserContext);

		expect(strategy.supports("https://example.com/report.pdf")).toBe(true);
		expect(strategy.supports("https://example.com/page")).toBe(false);
	});

	test("fetches raw response bytes through the browser context request API", async () => {
		const data = Buffer.from("%PDF-1.7");
		const get = vi.fn().mockResolvedValue({
			ok: () => true,
			status: () => 200,
			headers: () => ({ "content-type": "application/pdf" }),
			body: vi.fn().mockResolvedValue(data),
		});
		const context = { request: { get } } as unknown as BrowserContext;
		const strategy = new HTTPFetchStrategy(context);

		await expect(
			strategy.fetch("https://example.com/report.pdf", config),
		).resolves.toEqual({ data, contentType: "application/pdf" });
		expect(get).toHaveBeenCalledWith("https://example.com/report.pdf", {
			timeout: config.timeout,
		});
	});
});
