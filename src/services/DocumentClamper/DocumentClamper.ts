export const DEFAULT_CLAMP_LENGTH = 1_000_000;

export class DocumentClamper {
	clamp(parsable: string, clampLength: number = DEFAULT_CLAMP_LENGTH): string {
		if (parsable.length > clampLength) {
			const delta = parsable.length - clampLength;
			console.warn(
				`Did not process the last ${delta} of this text because it surpassed the maxContentLength of ${clampLength}`,
			);

			return parsable.slice(0, clampLength);
		}

		return parsable;
	}
}
