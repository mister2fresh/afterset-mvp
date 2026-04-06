import type { Context } from "hono";

export function internalError(c: Context, error: unknown): Response {
	console.error(error);
	return c.json({ error: "Internal server error" }, 500);
}
