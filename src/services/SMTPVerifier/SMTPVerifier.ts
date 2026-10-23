import net, { type Socket } from "node:net";
import z from "zod";

type SMTPVerificationResult = {
	status: "accepted" | "retryable" | "rejected" | "error" | "unknown";
	code?: number;
	message: string;
};

const MAX_RESPONSE_LENGTH = 10_000;
const DEFAULT_TIMEOUT = 15_000;
const GLOBAL_TIMEOUT = 45_000;
const responseLineRegex = /^(\d{3})([- ])(.*)$/;

export class SMTPVerifier {
	private readonly socketErrors = new WeakMap<Socket, Error>();

	constructor(
		private readonly from: string,
		private readonly mxDestinationHost: string,
		private readonly connectionConfig?: Omit<
			net.NetConnectOpts,
			"host" | "port"
		>,
	) {}

	async verify(email: string): Promise<SMTPVerificationResult> {
		const controller = new AbortController();
		const globalTimer = setTimeout(() => {
			controller.abort(new Error("SMTP verification exceeded 45 seconds"));
		}, GLOBAL_TIMEOUT);

		let socket: Socket | undefined = undefined;

		try {
			const ehloHostName = process.env.SMTP_EHLO_HOSTNAME;
			if (!ehloHostName) throw new Error("No configured ehlo Host Name");

			this.verifyEmail(email);
			this.verifyEmail(this.from);

			socket = await this.openConnection(controller.signal);

			const ehloRes = await this.sendCommand(socket, `EHLO ${ehloHostName}`);
			const parsedehloRes = this.parseSMTPRes(ehloRes);
			if (parsedehloRes.code !== 250)
				return {
					...parsedehloRes,
					status: parsedehloRes.status === "retryable" ? "retryable" : "error",
					message: `EHLO failed: ${parsedehloRes.message}`,
				};

			const mailFromRes = await this.sendCommand(
				socket,
				`MAIL FROM:<${this.from}>`,
			);
			const parsedMailFrom = this.parseSMTPRes(mailFromRes);
			if (parsedMailFrom.code !== 250)
				return {
					...parsedMailFrom,
					status: parsedMailFrom.status === "retryable" ? "retryable" : "error",
					message: `MAIL FROM failed: ${parsedMailFrom.message}`,
				};

			const rcptRes = await this.sendCommand(socket, `RCPT TO:<${email}>`);
			return this.parseSMTPRes(rcptRes);
		} catch (err: unknown) {
			return {
				status: "error",
				message:
					err instanceof Error
						? err.message
						: `An unknown error has caused verification of ${email} to fail`,
			};
		} finally {
			try {
				if (socket) await this.closeConnection(socket);
			} catch (err: unknown) {
				//if we crash with error during closure, we should still return original finding
			} finally {
				clearTimeout(globalTimer);
			}
		}
	}

	private parseSMTPRes(response: string): SMTPVerificationResult {
		const finalLine = response.split("\r\n").filter(Boolean).at(-1);
		const match = finalLine?.match(responseLineRegex);

		if (!match) {
			return {
				status: "error",
				message: `Invalid SMTP RCPT response: ${response}`,
			};
		}

		const code = Number(match[1]);
		const message = match[3] ?? "No applicable message";

		/*
			Status codes are semantically grouped in parsing. 
			See more [RFC Link](https://www.rfc-editor.org/info/rfc5321/#section-4.2.3)
		*/
		if ([250, 251].includes(code)) return { status: "accepted", code, message };

		if (code === 252) return { status: "unknown", code, message };

		if (code >= 400 && code < 500)
			return { status: "retryable", code, message };

		if (code >= 500) return { status: "rejected", code, message };

		return { status: "error", code, message };
	}

	private sendCommand(socket: Socket, command: string): Promise<string> {
		const error = this.socketErrors.get(socket);
		if (error) return Promise.reject(error);

		if (socket.destroyed || !socket.writable) {
			return Promise.reject(new Error("SMTP socket is closed"));
		}

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
				if (response.length > MAX_RESPONSE_LENGTH) {
					cleanup();
					return reject(
						new Error(
							`Response length surpassed maximum of ${MAX_RESPONSE_LENGTH}`,
						),
					);
				}

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

				reject(
					new Error("SMTP socket failed while reading the response", {
						cause: error,
					}),
				);
			};

			const onEnd = () => {
				cleanup();
				return reject(
					new Error("SMTP socket ended before the response completed"),
				);
			};

			const cleanup = () => {
				socket.off("data", onData);
				socket.off("error", onError);
				socket.off("end", onEnd);
				socket.off("close", onEnd);
			};

			socket.on("data", onData);
			socket.once("error", onError);
			socket.once("end", onEnd);
			socket.once("close", onEnd);
		});
	}

	private verifyEmail(email: string): void {
		try {
			z.email().parse(email);
		} catch (err: unknown) {
			throw new Error(`${email} is not a valid email`, { cause: err });
		}
	}

	private openConnection(abortSignal: AbortSignal): Promise<Socket> {
		return new Promise((resolve, reject) => {
			const socket = net.createConnection({
				timeout: DEFAULT_TIMEOUT,
				...(this.connectionConfig ?? {}),
				host: this.mxDestinationHost,
				port: 25,
				signal: abortSignal,
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
				reject(
					new Error("An error occurred during connection opening", {
						cause: error,
					}),
				);
			};

			const onTimeout = () => {
				socket.destroy(new Error("SMTP socket timed out"));
			};

			const cleanup = () => {
				socket.off("connect", onConnect);
				socket.off("error", onError);
			};

			const onSocketError = (error: Error) => {
				this.socketErrors.set(socket, error);
			};
			socket.on("error", onSocketError);

			socket.once("timeout", onTimeout);
			socket.once("connect", onConnect);
			socket.once("error", onError);
		});
	}

	private closeConnection(socket: Socket): Promise<void> {
		if (socket.destroyed) return Promise.resolve();

		return new Promise((resolve) => {
			const cleanup = () => {
				socket.removeAllListeners();
			};

			const onClose = () => {
				cleanup();
				resolve();
			};

			const onError = () => {
				cleanup();
				if (!socket.destroyed) socket.destroy();
				resolve();
			};

			socket.once("close", onClose);
			socket.once("error", onError);
			socket.end("QUIT\r\n");
		});
	}
}
