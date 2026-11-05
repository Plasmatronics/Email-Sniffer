export interface FetchResult {
	data: Buffer;
	contentType: string | null;
}

export interface WebsiteFetcherConfig {
	maxContentLength: number;
	timeout: number;
}

export interface WebsiteFetcher {
	fetch(url: string, config: WebsiteFetcherConfig): Promise<FetchResult>;
}
