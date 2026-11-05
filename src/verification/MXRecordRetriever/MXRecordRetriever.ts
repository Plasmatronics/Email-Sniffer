import { MinHeap } from "mnemonist";
import dns from "node:dns/promises";
import type { MxRecord } from "node:dns";
import { extractDomain } from "../../utils";

export const MAX_RECORDS = 5;
export const MIN_RECORDS = 1;
export const NUM_RECORDS_DEFAULT = 3;

const NO_MX_RECORD_DNS_ERROR_CODES = new Set([
	"EBADNAME",
	"ENODATA",
	"ENOTFOUND",
]);

export class MXRecordRetriever {
	private numRecordsToReturn: number;

	constructor(maxRecords: number = NUM_RECORDS_DEFAULT) {
		this.numRecordsToReturn = this.clampRecordsCap(maxRecords);
	}

	private clampRecordsCap(unverifiedRecordsCap: number): number {
		const normalizedCap = Number.isNaN(unverifiedRecordsCap)
			? NUM_RECORDS_DEFAULT
			: Math.floor(unverifiedRecordsCap);
		return Math.min(Math.max(MIN_RECORDS, normalizedCap), MAX_RECORDS);
	}

	async findMXRecords(domain: string): Promise<string[]> {
		const destinationDomain = extractDomain(domain);
		if (!destinationDomain) return [];

		let res: MxRecord[];
		try {
			res = await dns.resolveMx(destinationDomain);
		} catch (error) {
			if (
				error instanceof Error &&
				"code" in error &&
				NO_MX_RECORD_DNS_ERROR_CODES.has(String(error.code))
			) {
				return [];
			}

			throw error;
		}

		const highestPriorityRecords: string[] = [];
		const minHeap = MinHeap.from(
			res.filter((record) => record.exchange !== "." && record.exchange !== ""),
			(a: MxRecord, b: MxRecord) => a.priority - b.priority,
		);
		for (let i = 0; i < this.numRecordsToReturn; i++) {
			if (minHeap.size) highestPriorityRecords.push(minHeap.pop()!.exchange);
		}

		return highestPriorityRecords;
	}
}
