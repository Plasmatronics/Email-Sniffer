import { describe, expect, test } from "vitest";
import { MXRecordRetriever } from "../MXRecordRetriever/MXRecordRetriever.ts";
import { SMTPVerifier } from "./SMTPVerifier.ts";

describe("SMTPVerifier smoke tests", () => {
	test("verifies a live SMTP recipient", async () => {
		const fromMailbox = process.env.FROM_MAILBOX;
		const ehloHostName = process.env.SMTP_EHLO_HOSTNAME;
		const recipient = process.env.SMOKE_TEST_EMAIL;

		if (!fromMailbox)
			throw new Error("Missing configuration variable for FROM_MAILBOX");
		if (!ehloHostName)
			throw new Error("Missing configuration variable for SMTP_EHLO_HOSTNAME");
		if (!recipient)
			throw new Error("Missing configuration variable for SMOKE_TEST_EMAIL");

		const mxRecords = await new MXRecordRetriever().findMXRecords(recipient);
		const result = await new SMTPVerifier(fromMailbox, ehloHostName).verify(
			recipient,
			mxRecords,
		);
		console.log({ result });

		expect(["accepted", "rejected", "unknown"]).toContain(result.status);
	}, 60_000);
});
