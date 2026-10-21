import { EventEmitter } from "node:events";
import net, { type Socket } from "node:net";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { SMTPVerifier } from "./SMTPVerifier.ts";

vi.mock("node:net", () => ({
	default: {
		createConnection: vi.fn(),
	},
}));

const createConnection = vi.mocked(net.createConnection);

class MockSocket extends EventEmitter {
	destroyed = false;
	private readonly responses: Array<string | string[] | Error>;

	constructor(responses: Array<string | string[] | Error>) {
		super();
		this.responses = [...responses];
	}

	write = vi.fn((command: string) => {
		void command;
		const response = this.responses.shift();
		const chunks = Array.isArray(response) ? response : [response];

		for (const chunk of chunks) {
			queueMicrotask(() => {
				if (chunk instanceof Error) {
					this.emit("error", chunk);
				} else if (chunk !== undefined) {
					this.emit("data", Buffer.from(chunk));
				}
			});
		}
		return true;
	});

	end = vi.fn(() => {
		this.destroyed = true;
		queueMicrotask(() => this.emit("close", false));
		return this;
	});

	destroy = vi.fn(() => {
		this.destroyed = true;
		queueMicrotask(() => this.emit("close", true));
		return this;
	});
}

function mockConnection(
	commandResponses: Array<string | string[] | Error>,
	greeting = "220 mx.example.com ready\r\n",
): MockSocket {
	const socket = new MockSocket(commandResponses);
	createConnection.mockImplementationOnce(() => {
		queueMicrotask(() => {
			socket.emit("connect");
			queueMicrotask(() => socket.emit("data", Buffer.from(greeting)));
		});
		return socket as unknown as Socket;
	});
	return socket;
}

function successfulResponses(rcptResponse: string): string[] {
	return ["250 mx.example.com hello\r\n", "250 sender ok\r\n", rcptResponse];
}

describe("SMTPVerifier", () => {
	beforeEach(() => {
		createConnection.mockReset();
	});

	test.each([
		{ code: 250, message: "recipient ok", status: "accepted" },
		{ code: 251, message: "will forward", status: "accepted" },
		{
			code: 252,
			message: "cannot verify, will accept",
			status: "unknown",
		},
		{ code: 450, message: "mailbox busy", status: "retryable" },
		{ code: 421, message: "service unavailable", status: "retryable" },
		{ code: 451, message: "processing error", status: "retryable" },
		{ code: 452, message: "insufficient storage", status: "retryable" },
		{ code: 455, message: "parameters unavailable", status: "retryable" },
		{ code: 550, message: "mailbox unavailable", status: "rejected" },
		{ code: 551, message: "user not local", status: "rejected" },
		{ code: 552, message: "storage exceeded", status: "rejected" },
		{ code: 553, message: "mailbox not allowed", status: "rejected" },
		{ code: 554, message: "transaction failed", status: "rejected" },
		{
			code: 555,
			message: "parameters not recognized",
			status: "error",
		},
	])("classifies a $code RCPT response as $status", async (result) => {
		mockConnection(successfulResponses(`${result.code} ${result.message}\r\n`));
		const verifier = new SMTPVerifier("sender@example.com", "mx.example.com");

		await expect(verifier.verify("recipient@example.com")).resolves.toEqual(
			result,
		);
	});

	test("waits for a complete CRLF-terminated RCPT response", async () => {
		mockConnection([
			"250 mx.example.com hello\r\n",
			"250 sender ok\r\n",
			["250 recipient", " ok\r\n"],
		]);
		const verifier = new SMTPVerifier("sender@example.com", "mx.example.com");

		await expect(verifier.verify("recipient@example.com")).resolves.toEqual({
			status: "accepted",
			code: 250,
			message: "recipient ok",
		});
	});

	test("rejects a response containing a malformed line", async () => {
		mockConnection(
			successfulResponses("malformed response\r\n250 recipient ok\r\n"),
		);
		const verifier = new SMTPVerifier("sender@example.com", "mx.example.com");

		await expect(verifier.verify("recipient@example.com")).rejects.toThrow(
			"Invalid SMTP response line",
		);
	});

	test("rejects a multiline greeting whose reply codes do not match", async () => {
		mockConnection(
			successfulResponses("250 recipient ok\r\n"),
			"220-localhost ready\r\n550 greeting failed\r\n",
		);
		const verifier = new SMTPVerifier("sender@example.com", "mx.example.com");

		await expect(verifier.verify("recipient@example.com")).rejects.toThrow(
			"Invalid SMTP response",
		);
	});

	test("sends the SMTP commands in transaction order", async () => {
		const socket = mockConnection(successfulResponses("250 recipient ok\r\n"));
		const verifier = new SMTPVerifier("sender@example.com", "mx.example.com");

		await verifier.verify("recipient@example.com");

		expect(socket.write.mock.calls.map(([command]) => command)).toEqual([
			"EHLO ...\r\n",
			"MAIL FROM:<sender@example.com>\r\n",
			"RCPT TO:<recipient@example.com>\r\n",
		]);
	});

	test("rejects an invalid SMTP greeting", async () => {
		mockConnection([], "554 No SMTP service here\r\n");
		const verifier = new SMTPVerifier("sender@example.com", "mx.example.com");

		await expect(verifier.verify("recipient@example.com")).rejects.toThrow(
			"SMTP server returned invalid greeting",
		);
	});

	test("destroys the socket after an invalid SMTP greeting", async () => {
		const socket = mockConnection([], "554 No SMTP service here\r\n");
		const verifier = new SMTPVerifier("sender@example.com", "mx.example.com");

		await verifier.verify("recipient@example.com").catch(() => undefined);

		expect(socket.destroy).toHaveBeenCalledOnce();
	});

	test("propagates connection errors", async () => {
		const socket = new MockSocket([]);
		const connectionError = new Error("connection refused");
		createConnection.mockImplementationOnce(() => {
			queueMicrotask(() => socket.emit("error", connectionError));
			return socket as unknown as Socket;
		});
		const verifier = new SMTPVerifier("sender@example.com", "mx.example.com");

		await expect(verifier.verify("recipient@example.com")).rejects.toBe(
			connectionError,
		);
	});

	test("closes the socket after a successful verification", async () => {
		const socket = mockConnection(successfulResponses("250 recipient ok\r\n"));
		const verifier = new SMTPVerifier("sender@example.com", "mx.example.com");

		await verifier.verify("recipient@example.com");

		expect(socket.end).toHaveBeenCalledOnce();
	});

	test("closes the socket after a command fails", async () => {
		const socket = mockConnection([new Error("EHLO failed")]);
		const verifier = new SMTPVerifier("sender@example.com", "mx.example.com");

		await verifier.verify("recipient@example.com").catch(() => undefined);

		expect(socket.end).toHaveBeenCalledOnce();
	});

	test("uses independent sockets for concurrent verifications", async () => {
		mockConnection(successfulResponses("250 first recipient ok\r\n"));
		mockConnection(successfulResponses("550 second recipient unavailable\r\n"));
		const verifier = new SMTPVerifier("sender@example.com", "mx.example.com");

		const results = await Promise.all([
			verifier.verify("first@example.com"),
			verifier.verify("second@example.com"),
		]);

		expect(results).toEqual([
			{
				status: "accepted",
				code: 250,
				message: "first recipient ok",
			},
			{
				status: "rejected",
				code: 550,
				message: "second recipient unavailable",
			},
		]);
	});
});
