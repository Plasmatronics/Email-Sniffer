import { logger } from "../../infrastructure";

export const DEFAULT_CLAMP_LENGTH = 1_000_000;

export class DocumentClamper {
	private readonly serviceName = "DocumentClamper";

	clamp(parsable: string, clampLength: number = DEFAULT_CLAMP_LENGTH): string {
		const startTime = Date.now();
		const childLogger = logger.child({ serviceName: this.serviceName });
		if (parsable.length > clampLength) {
			const delta = parsable.length - clampLength;
			childLogger.warn(
				{
					truncatedCharacters: delta,
					maxContentLength: clampLength,
					durationMs: Date.now() - startTime,
				},
				"Document content was truncated",
			);

			return parsable.slice(0, clampLength);
		}

		return parsable;
	}
}
