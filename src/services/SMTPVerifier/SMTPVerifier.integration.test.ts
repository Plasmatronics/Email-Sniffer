import net, { type AddressInfo, type Server } from "node:net";
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import { SMTPVerifier } from "./SMTPVerifier.ts";

const connect = net.createConnection.bind(net);

describe("SMTPVerifier integration", () => {
	let server: Server;
	let createConnectionSpy: ReturnType<typeof vi.spyOn>;

	beforeAll(async () => {
		server = net.createServer((socket) => {
			socket.write("220 localhost ready\r\n");
			let requestBuffer = "";

			socket.on("data", (chunk) => {
				requestBuffer += chunk.toString();

				let lineEnd = requestBuffer.indexOf("\r\n");
				while (lineEnd >= 0) {
					const command = requestBuffer.slice(0, lineEnd);
					requestBuffer = requestBuffer.slice(lineEnd + 2);

					if (command.startsWith("EHLO ")) {
						socket.write("250-localhost\r\n250 PIPELINING\r\n");
					} else if (command.startsWith("MAIL FROM:")) {
						socket.write("250 sender ok\r\n");
					} else if (command === "RCPT TO:<accepted@example.com>") {
						socket.write("250 recipient ok\r\n");
					} else if (command === "RCPT TO:<rejected@example.com>") {
						socket.write("550 recipient unavailable\r\n");
					} else {
						socket.write("500 unexpected command\r\n");
					}

					lineEnd = requestBuffer.indexOf("\r\n");
				}
			});
		});

		await new Promise<void>((resolve, reject) => {
			server.once("error", reject);
			server.listen(0, "127.0.0.1", resolve);
		});

		const address = server.address() as AddressInfo;
		createConnectionSpy = vi
			.spyOn(net, "createConnection")
			.mockImplementation((() =>
				connect({
					host: "127.0.0.1",
					port: address.port,
				})) as typeof net.createConnection);
	});

	afterAll(async () => {
		createConnectionSpy.mockRestore();
		await new Promise<void>((resolve, reject) => {
			server.close((error) => (error ? reject(error) : resolve()));
		});
	});

	test("completes an SMTP verification over a real socket", async () => {
		const verifier = new SMTPVerifier("sender@example.com", "mx.example.com");

		await expect(verifier.verify("accepted@example.com")).resolves.toEqual({
			status: "accepted",
			code: 250,
			message: "recipient ok",
		});
	});

	test("runs concurrent SMTP verifications on independent sockets", async () => {
		const verifier = new SMTPVerifier("sender@example.com", "mx.example.com");

		const results = await Promise.all([
			verifier.verify("accepted@example.com"),
			verifier.verify("rejected@example.com"),
		]);

		expect(results.map(({ status }) => status)).toEqual([
			"accepted",
			"rejected",
		]);
	});
});
