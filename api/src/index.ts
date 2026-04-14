import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { auth } from "./middleware/auth.js";
import { rateLimit } from "./middleware/rate-limit.js";
import analytics from "./routes/analytics.js";
import broadcasts from "./routes/broadcasts.js";
import build from "./routes/build.js";
import capturePages from "./routes/capture-pages.js";
import captures from "./routes/captures.js";
import dev from "./routes/dev.js";
import deviceTokens from "./routes/device-tokens.js";
import download from "./routes/download.js";
import email from "./routes/email.js";
import emailTemplates from "./routes/email-templates.js";
import incentive from "./routes/incentive.js";
import pausedEmails from "./routes/paused-emails.js";
import sendBatch from "./routes/send-batch.js";
import settings from "./routes/settings.js";
import smsKeywords from "./routes/sms-keywords.js";
import usage from "./routes/usage.js";

const app = new Hono();

app.use("*", logger());
app.use(
	"/api/*",
	cors({
		origin: process.env.CORS_ORIGINS
			? process.env.CORS_ORIGINS.split(",").map((o) => o.trim())
			: ["http://localhost:5173"],
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

app.route("/download", download);
app.route("/api/email", email);
app.route("/api/emails", sendBatch);

// Rate limits: per-artist for auth'd routes, per-IP for public routes
const artistLimit = rateLimit({
	max: 120,
	windowMs: 60_000,
	keyFn: (c) => (c.get("artist") as { id: string })?.id ?? "anon",
});
const publicLimit = rateLimit({ max: 30, windowMs: 60_000 });

app.use("/download/*", publicLimit);
app.use("/api/email/*", publicLimit);

const authedPaths = [
	"/api/settings",
	"/api/capture-pages",
	"/api/analytics",
	"/api/broadcasts",
	"/api/captures",
	"/api/device-tokens",
	"/api/usage",
	"/api/paused-emails",
];
const isDev = process.env.NODE_ENV !== "production";
if (isDev) authedPaths.push("/api/dev");

// Auth: protect all authenticated API routes (public: /api/health, /api/email, /api/emails)
for (const path of authedPaths) {
	app.use(path, auth, artistLimit);
	app.use(`${path}/*`, auth, artistLimit);
}

app.route("/api/settings", settings);
if (isDev) app.route("/api/dev", dev);

// /api/capture-pages — 6 route modules share this base path.
// Mount smsKeywords before capturePages so its literal /keywords route
// resolves before capturePages' catch-all /:id handler.
app.route("/api/capture-pages", smsKeywords); // /keywords, /:id/keyword (sms-keywords.ts)
app.route("/api/capture-pages", capturePages); // CRUD + QR (capture-pages.ts)
app.route("/api/capture-pages", incentive); // /:id/incentive (incentive.ts)
app.route("/api/capture-pages", build); // /:id/build (build.ts)
app.route("/api/capture-pages", emailTemplates); // /:id/email-template, /:id/email-sequence (email-templates.ts)
app.route("/api/capture-pages", analytics); // /:id/analytics (analytics.ts)

app.route("/api/analytics", analytics); // /tonight, / (overview)
app.route("/api/broadcasts", broadcasts);
app.route("/api/captures", captures);
app.route("/api/device-tokens", deviceTokens);
app.route("/api/usage", usage);
app.route("/api/paused-emails", pausedEmails);

const port = Number(process.env.PORT) || 3000;
console.log(`API server running on port ${port}`);

serve({ fetch: app.fetch, port });

export default app;
