import { WebsiteFetcherConfig } from "./websiteFetcher.types";

export * from "./PlaywrightWebsiteFetcher";
export * from "./websiteFetcher.types";
export * from "./fetchingStrategies";

export const DEFAULT_WEBSITE_FETCHER_CONFIG: WebsiteFetcherConfig = {
	maxContentLength: 10_000_000,
	timeout: 8_000,
};
