import z from "zod";
import { WebSearchResult } from "../../types";

export const SerperResult = z.object({
	title: z.string(),
	link: z.string(),
	date: z.string().optional(),
	snippet: z.string().optional(),
	position: z.number(),
}) satisfies z.ZodType<WebSearchResult>;

export const SerperResponseSchema = z.object({
	organic: z.array(SerperResult),
});
