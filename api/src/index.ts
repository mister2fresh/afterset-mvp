import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { auth } from "./middleware/auth.js";
import analytics from "./routes/analytics.js";
import build from "./routes/build.js";
import capturePages from "./routes/capture-pages.js";
import captures from "./routes/captures.js";
import email from "./routes/email.js";
import emailTemplates from "./routes/email-templates.js";
import incentive from "./routes/incentive.js";
import sendBatch from "./routes/send-batch.js";
import settings from "./routes/settings.js";

const app = new Hono();

app.use("*", logger());
app.use(
	"/api/*",
	cors({
		origin: ["http://localhost:5173"],
		credentials: true,
	}),
);

app.get("/api/health", async (c) => {
	const { supabase } = await import("./lib/supabase.js");
	const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

	const { count } = await supabase
		.from("pending_emails")
		.select("id", { count: "exact", head: true })
		.eq("status", "pending")
		.lt("send_at", oneHourAgo);

	const stuckCount = count ?? 0;
	const status = stuckCount > 0 ? "degraded" : "ok";

	return c.json({
		status,
		timestamp: new Date().toISOString(),
		...(stuckCount > 0 && { stuck_emails: stuckCount }),
	});
});

app.route("/api/email", email);
app.route("/api/emails", sendBatch);

app.use("/api/settings", auth);
app.use("/api/settings/*", auth);
app.route("/api/settings", settings);

app.use("/api/capture-pages", auth);
app.use("/api/capture-pages/*", auth);
app.route("/api/capture-pages", capturePages);
app.route("/api/capture-pages", incentive);
app.route("/api/capture-pages", build);
app.route("/api/capture-pages", emailTemplates);
app.route("/api/capture-pages", analytics);

app.use("/api/analytics", auth);
app.use("/api/analytics/*", auth);
app.route("/api/analytics", analytics);

app.use("/api/captures", auth);
app.use("/api/captures/*", auth);
app.route("/api/captures", captures);

const port = Number(process.env.PORT) || 3000;
console.log(`API server running on port ${port}`);

serve({ fetch: app.fetch, port });

export default app;
