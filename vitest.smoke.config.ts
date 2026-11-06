import { configDotenv } from "dotenv";
import { defineConfig } from "vitest/config";

configDotenv({ path: "./.env" });

export default defineConfig({
	test: {
		include: ["**/*.smoke.test.ts"],
		clearMocks: true,
	},
});
