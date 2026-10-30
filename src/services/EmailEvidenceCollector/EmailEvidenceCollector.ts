import { EmailPattern } from "../../shared";

export abstract class EmailEvidenceCollector<
	Input,
	Dependencies,
	Config = undefined,
> {
	constructor(
		protected dependencies: Dependencies,
		protected config?: Config,
	) {}

	abstract collect(input: Input): Promise<EmailEvidence[]>;
}

export interface EmailEvidence {
	email: string;
	pattern: EmailPattern;
	source: string;
	domainConfidence: number;
}
