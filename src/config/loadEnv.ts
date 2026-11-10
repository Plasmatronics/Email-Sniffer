import { configDotenv } from "dotenv";

export interface EnvConfig {
	fromEmail: string;
	ehloHostName: string;
	serverPort: number;
	apiKey: string;
	smokeTestFetchUrl: string;
	logLevel: string;
	nodeEnv: string;
}

export function loadEnv(path = "./.env"): Readonly<EnvConfig> {
	configDotenv({ path });

	const {
		FROM_MAILBOX: fromEmail,
		SMTP_EHLO_HOSTNAME: ehloHostName,
		SERVER_PORT: serverPort,
		SERPER_API_KEY: apiKey,
		SMOKE_TEST_FETCH_URL: smokeTestFetchUrl,
		LOG_LEVEL: logLevel,
		NODE_ENV: nodeEnv,
	} = process.env;

	if (!fromEmail)
		throw new Error("Missing configuration variable for FROM_MAILBOX");
	if (!ehloHostName)
		throw new Error("Missing configuration variable for SMTP_EHLO_HOSTNAME");
	if (!serverPort)
		throw new Error("Missing configuration variable for SERVER_PORT");
	if (!apiKey)
		throw new Error("Missing configuration variable for SERPER_API_KEY");
	if (!smokeTestFetchUrl)
		throw new Error("Missing configuration variable for SMOKE_TEST_FETCH_URL");
	if (!logLevel)
		throw new Error("Missing configuration variable for LOG_LEVEL");
	if (!nodeEnv) throw new Error("Missing configuration variable for NODE_ENV");

	const serverPortNumber = Number(serverPort);
	if (
		!Number.isInteger(serverPortNumber) ||
		serverPortNumber <= 0 ||
		serverPortNumber > 65535
	) {
		throw new Error("Invalid SERVER_PORT");
	}

	return Object.freeze({
		fromEmail,
		ehloHostName,
		serverPort: serverPortNumber,
		apiKey,
		smokeTestFetchUrl,
		logLevel,
		nodeEnv,
	});
}
