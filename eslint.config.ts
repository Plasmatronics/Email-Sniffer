import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import { defineConfig } from "eslint/config";
import eslintConfigPrettier from "eslint-config-prettier";

export default defineConfig([
	{
		ignores: ["**/dist/**", "**/build/**", "**/coverage/**"],
	},

	tseslint.configs.recommended,

	{
		files: ["**/*.{js,mjs,cjs,ts,mts,cts}"],
		plugins: {
			js,
		},
		extends: ["js/recommended"],
		languageOptions: {
			globals: {
				...globals.node,
			},
		},
		rules: {
			"no-unused-vars": "off",
			"@typescript-eslint/no-unused-vars": "warn",
			"no-irregular-whitespace": "off",
		},
	},

	eslintConfigPrettier,

	{
		files: ["**/*.test.ts"],
		rules: {
			"@typescript-eslint/no-explicit-any": "off",
		},
	},
]);
