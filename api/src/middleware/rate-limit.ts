import type { Context, MiddlewareHandler } from "hono";

type Entry = { count: number; resetAt: number };
const store = new Map<string, Entry>();

let lastCleanup = 0;
function cleanup(): void {
	const now = Date.now();
	if (now - lastCleanup < 60_000) return;
	lastCleanup = now;
	for (const [key, entry] of store) {
		if (now >= entry.resetAt) store.delete(key);
	}
}

export function rateLimit(opts: {
	max: number;
	windowMs: number;
	keyFn?: (c: Context) => string;
}): MiddlewareHandler {
	return async (c, next) => {
		cleanup();
		const key = opts.keyFn?.(c) ?? c.req.header("x-forwarded-for") ?? "unknown";
		const now = Date.now();
		const entry = store.get(key);

		if (!entry || now >= entry.resetAt) {
			store.set(key, { count: 1, resetAt: now + opts.windowMs });
			await next();
			return;
		}

		entry.count++;
		if (entry.count > opts.max) {
			return c.json({ error: "Too many requests" }, 429);
		}

		await next();
	};
}
