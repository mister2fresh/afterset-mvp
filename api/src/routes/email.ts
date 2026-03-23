import { Hono } from "hono";
import type { WebhookEventPayload } from "resend";
import { addSuppression, getResendClient, verifyUnsubscribeToken } from "../lib/email/index.js";
import { supabase } from "../lib/supabase.js";

const email = new Hono();

// RFC 8058 one-click unsubscribe (POST from email clients)
email.post("/unsubscribe", async (c) => {
	const token = c.req.query("token");
	if (!token) return c.json({ error: "Missing token" }, 400);

	const payload = verifyUnsubscribeToken(token);
	if (!payload) return c.json({ error: "Invalid token" }, 400);

	await addSuppression(payload.email, payload.artistId, "manual_unsubscribe");
	return c.json({ ok: true });
});

// Browser fallback unsubscribe (GET from clicking the link)
email.get("/unsubscribe", async (c) => {
	const token = c.req.query("token");
	if (!token) return c.text("Invalid unsubscribe link.", 400);

	const payload = verifyUnsubscribeToken(token);
	if (!payload) return c.text("Invalid or expired unsubscribe link.", 400);

	await addSuppression(payload.email, payload.artistId, "manual_unsubscribe");

	return c.html(`<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Unsubscribed</title>
<style>body{font-family:system-ui,sans-serif;background:#0a0e1a;color:#e5e7eb;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}
.card{text-align:center;max-width:400px;padding:2rem}</style></head>
<body><div class="card">
<h1 style="font-size:1.5rem">You've been unsubscribed</h1>
<p>You will no longer receive emails from this artist via Afterset.</p>
</div></body></html>`);
});

// Resend webhook receiver
email.post("/webhooks/resend", async (c) => {
	const secret = process.env.RESEND_WEBHOOK_SECRET;
	if (!secret) return c.json({ error: "Webhook secret not configured" }, 500);

	const body = await c.req.text();
	const id = c.req.header("svix-id");
	const timestamp = c.req.header("svix-timestamp");
	const signature = c.req.header("svix-signature");

	if (!id || !timestamp || !signature) {
		return c.json({ error: "Missing webhook headers" }, 400);
	}

	let event: WebhookEventPayload;
	try {
		const resend = getResendClient();
		event = resend.webhooks.verify({
			payload: body,
			headers: { id, timestamp, signature },
			webhookSecret: secret,
		});
	} catch {
		return c.json({ error: "Invalid signature" }, 401);
	}

	await handleWebhookEvent(event);
	return c.json({ ok: true });
});

async function handleWebhookEvent(event: WebhookEventPayload): Promise<void> {
	if (event.type === "email.bounced" && event.data.bounce.type === "hard") {
		await handleBounceOrComplaint(event.data.email_id, "hard_bounce");
	} else if (event.type === "email.complained") {
		await handleBounceOrComplaint(event.data.email_id, "complaint");
	} else if (event.type === "email.delivered") {
		await supabase
			.from("pending_emails")
			.update({ status: "sent" })
			.eq("provider_message_id", event.data.email_id);
	}
}

async function handleBounceOrComplaint(
	emailId: string,
	reason: "hard_bounce" | "complaint",
): Promise<void> {
	const { data } = await supabase
		.from("pending_emails")
		.select("artist_id, email")
		.eq("provider_message_id", emailId)
		.limit(1)
		.single();

	if (data) {
		await addSuppression(data.email, data.artist_id, reason);
		await supabase
			.from("pending_emails")
			.update({ status: "failed" })
			.eq("provider_message_id", emailId);
	}
}

export default email;
