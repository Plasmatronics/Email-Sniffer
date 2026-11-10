import pino from "pino";

const isDevelopment = process.env.NODE_ENV !== "production";
console.log(process.env.LOG_LEVEL);
export const logger = pino({
	level: process.env.LOG_LEVEL ?? "info",
	...(isDevelopment && {
		transport: {
			target: "pino-pretty",
			options: {
				colorize: true,
				translateTime: "SYS:standard",
			},
		},
	}),
});
