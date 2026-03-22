import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

const app = new Hono();

app.use("*", logger());
app.use(
	"/api/*",
	cors({
		origin: ["http://localhost:5173"],
		credentials: true,
	}),
);

app.get("/api/health", (c) => {
	return c.json({ status: "ok", timestamp: new Date().toISOString() });
});

const port = Number(process.env.PORT) || 3000;
console.log(`API server running on port ${port}`);

serve({ fetch: app.fetch, port });

export default app;
