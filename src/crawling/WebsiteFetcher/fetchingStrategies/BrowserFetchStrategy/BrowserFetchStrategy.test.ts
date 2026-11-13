import type { Browser, Page } from "playwright";
import { describe, expect, test, vi } from "vitest";
import { BrowserFetchStrategy } from "./BrowserFetchStrategy";

const config = { maxContentLength: 1_000, timeout: 5_000 };

describe("BrowserFetchStrategy", () => {
	test("supports non-PDF URLs", () => {
		const strategy = new BrowserFetchStrategy({} as Browser);

		expect(strategy.supports("https://example.com/page")).toBe(true);
		expect(strategy.supports("https://example.com/report.pdf")).toBe(false);
	});

	test("fetches rendered HTML through a browser page", async () => {
		const page = {
			goto: vi.fn().mockResolvedValue({
				ok: () => true,
				status: () => 200,
				headerValue: vi.fn().mockResolvedValue("text/html; charset=utf-8"),
			}),
			content: vi.fn().mockResolvedValue("<body>rendered</body>"),
			close: vi.fn().mockResolvedValue(undefined),
		} as unknown as Page;
		const browser = {
			newPage: vi.fn().mockResolvedValue(page),
		} as unknown as Browser;
		const strategy = new BrowserFetchStrategy(browser);

		await expect(
			strategy.fetch("https://example.com/page", config),
		).resolves.toEqual({
			data: Buffer.from("<body>rendered</body>"),
			contentType: "text/html; charset=utf-8",
		});
		expect(page.close).toHaveBeenCalledOnce();
	});
});
