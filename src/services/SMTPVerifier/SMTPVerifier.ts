import net, { type Socket } from "node:net";

type SMTPVerificationResult = {
	status: "accepted" | "retryable" | "rejected" | "error" | "unknown";
	code: number;
	message: string;
};

const responseLineRegex = /^(\d{3})([- ]).*$/;

export class SMTPVerifier {
	constructor(
		private readonly from: string,
		private readonly mxDestinationHost: string,
		private readonly connectionConfig?: net.NetConnectOpts,
	) {}

	async verify(email: string): Promise<SMTPVerificationResult> {
		const socket = await this.openConnection();

		try {
			await this.sendCommand(socket, "EHLO ...");
			await this.sendCommand(socket, `MAIL FROM:<${this.from}>`);
			const rcpt = await this.sendCommand(socket, `RCPT TO:<${email}>`);

			return this.parseRcpt(rcpt);
		} finally {
			await this.closeConnection(socket);
		}
	}

	private parseRcpt(response: string): SMTPVerificationResult {
		const finalLine = response.split("\r\n").filter(Boolean).at(-1);
		const match = finalLine?.match(/^(\d{3}) (.*)$/);

		if (!match) throw new Error(`Invalid SMTP RCPT response: ${response}`);

		const code = Number(match[1]);
		const message = match[2];

		/*
			Status codes are semantically grouped in parsing. 
			See more [RFC Link](https://www.rfc-editor.org/info/rfc5321/#section-4.2.3)
		*/
		if ([250, 251].includes(code)) return { status: "accepted", code, message };

		if (code === 252) return { status: "unknown", code, message };

		if ([421, 450, 451, 452, 455].includes(code))
			return { status: "retryable", code, message };

		if ([550, 551, 552, 553, 554].includes(code))
			return { status: "rejected", code, message };

		return { status: "error", code, message };
	}

	private openConnection(): Promise<Socket> {
		return new Promise((resolve, reject) => {
			const socket = net.createConnection({
				...(this.connectionConfig ?? {}),
				host: this.mxDestinationHost,
				port: 25,
			});

			const onConnect = async () => {
				cleanup();

				try {
					const greeting = await this.readSocketResponse(socket);

					if (!greeting.startsWith("220")) {
						throw new Error(
							`SMTP server returned invalid greeting: ${greeting}`,
						);
					}

					resolve(socket);
				} catch (error) {
					socket.destroy();
					reject(error);
				}
			};

			const onError = (error: Error) => {
				cleanup();
				reject(error);
			};

			const cleanup = () => {
				socket.off("connect", onConnect);
				socket.off("error", onError);
			};

			socket.once("connect", onConnect);
			socket.once("error", onError);
		});
	}

	private closeConnection(socket: Socket): Promise<void> {
		if (socket.destroyed) return Promise.resolve();

		return new Promise((resolve) => {
			socket.once("close", resolve);
			socket.end();
		});
	}

	private sendCommand(socket: Socket, command: string): Promise<string> {
		const responsePromise = this.readSocketResponse(socket);
		socket.write(`${command}\r\n`);
		return responsePromise;
	}

	private readSocketResponse(socket: Socket): Promise<string> {
		return new Promise((resolve, reject) => {
			let response: string = "";
			let parsedLength = 0;
			let responseCode: string;

			const onData = (chunk: Buffer) => {
				response += chunk.toString();

				let lineEnd = response.indexOf("\r\n", parsedLength);
				while (lineEnd >= 0) {
					const line = response.slice(parsedLength, lineEnd);
					parsedLength = lineEnd + 2;

					const match = line.match(responseLineRegex);
					if (!match) {
						cleanup();
						return reject(new Error(`Invalid SMTP response line: ${line}`));
					}

					const [, code, separator] = match;
					responseCode ??= code;

					if (code !== responseCode) {
						cleanup();
						return reject(
							new Error(
								`Invalid SMTP response: initially received code ${responseCode}, then ${code}`,
							),
						);
					}

					/*
						As per RFC 5321, the final reply line has a space after its
						status code, while continuation lines have a hyphen.
					*/
					if (separator === " ") {
						if (parsedLength !== response.length) {
							cleanup();
							return reject(
								new Error(
									"Invalid SMTP response: data follows the final reply line",
								),
							);
						}

						cleanup();
						return resolve(response);
					}

					lineEnd = response.indexOf("\r\n", parsedLength);
				}
			};

			const onError = (error: Error) => {
				cleanup();
				return reject(error);
			};

			const cleanup = () => {
				socket.off("data", onData);
				socket.off("error", onError);
			};

			socket.on("data", onData);
			socket.once("error", onError);
		});
	}
}
