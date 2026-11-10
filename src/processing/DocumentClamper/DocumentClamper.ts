import { logger } from "../../infrastructure";

export const DEFAULT_CLAMP_LENGTH = 1_000_000;

export class DocumentClamper {
	clamp(parsable: string, clampLength: number = DEFAULT_CLAMP_LENGTH): string {
		if (parsable.length > clampLength) {
			const delta = parsable.length - clampLength;
			logger.warn(
				{ truncatedCharacters: delta, maxContentLength: clampLength },
				"Document content was truncated",
			);

			return parsable.slice(0, clampLength);
		}

		return parsable;
	}
}
