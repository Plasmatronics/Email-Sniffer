import { EmailPattern, PatternInference } from "../../shared";

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

export interface EmailEvidence extends PatternInference {
	source: string;
	domainConfidence: number;
}
