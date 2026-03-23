import { Hono } from "hono";
import { z } from "zod";
import { getEmailService } from "../lib/email/index.js";
import { renderFollowUpHtml } from "../lib/email/render-template.js";
import type { SendParams } from "../lib/email/types.js";
import { supabase } from "../lib/supabase.js";

const app = new Hono();

const BATCH_LIMIT = 50;

const requestSchema = z.object({
	ids: z.array(z.string().uuid()).min(1).max(BATCH_LIMIT).optional(),
});

/**
 * POST /api/emails/send-batch
 *
 * Called by pg_cron via pg_net. Fetches pending emails ready to send,
 * resolves their templates, sends via Resend batch API, updates status.
 *
 * Accepts optional { ids: [...] } body. If no IDs provided, polls for
 * pending emails where send_at <= NOW().
 */
app.post("/send-batch", async (c) => {
	const start = performance.now();
	const secret = c.req.header("X-Batch-Secret");
	const expected = process.env.BATCH_SEND_SECRET;
	if (!expected || secret !== expected) {
		return c.json({ error: "Unauthorized" }, 401);
	}

	const body = await c.req.json().catch(() => ({}));
	const parsed = requestSchema.safeParse(body);
	if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

	// Fetch pending emails ready to send
	let query = supabase
		.from("pending_emails")
		.select("id, fan_capture_id, artist_id, email, retry_count")
		.eq("status", "pending")
		.lte("send_at", new Date().toISOString())
		.order("send_at", { ascending: true })
		.limit(BATCH_LIMIT);

	if (parsed.data?.ids) {
		query = query.in("id", parsed.data.ids);
	}

	const { data: pendingRows, error: fetchErr } = await query;
	if (fetchErr) return c.json({ error: fetchErr.message }, 500);
	if (!pendingRows || pendingRows.length === 0) {
		return c.json({ sent: 0, failed: 0, skipped: 0 });
	}

	// Claim these rows (set status to 'sending' to prevent double-pickup)
	const pendingIds = pendingRows.map((r) => r.id);
	await supabase.from("pending_emails").update({ status: "sending" }).in("id", pendingIds);

	// Collect unique artist IDs to batch-fetch templates and artist info
	const artistIds = [...new Set(pendingRows.map((r) => r.artist_id))];

	const { data: artists } = await supabase.from("artists").select("id, name").in("id", artistIds);

	const artistMap = new Map((artists ?? []).map((a) => [a.id, a as { id: string; name: string }]));

	// Get fan_capture_ids to find which capture_page each fan came from
	const fanCaptureIds = [...new Set(pendingRows.map((r) => r.fan_capture_id))];

	const { data: captureEvents } = await supabase
		.from("capture_events")
		.select("fan_capture_id, capture_page_id")
		.in("fan_capture_id", fanCaptureIds);

	const fanToPage = new Map(
		(captureEvents ?? []).map((e) => [e.fan_capture_id, e.capture_page_id]),
	);

	// Fetch all relevant email templates
	const pageIds = [...new Set([...fanToPage.values()])];

	const { data: templates } = await supabase
		.from("email_templates")
		.select("capture_page_id, subject, body, include_incentive_link, is_active")
		.in("capture_page_id", pageIds);

	const templateMap = new Map((templates ?? []).map((t) => [t.capture_page_id, t]));

	// Fetch incentive download URLs for pages that need them
	const pagesWithIncentive = (templates ?? [])
		.filter((t) => t.include_incentive_link)
		.map((t) => t.capture_page_id);

	const incentiveUrlMap = new Map<string, string>();
	if (pagesWithIncentive.length > 0) {
		const { data: incentives } = await supabase
			.from("incentive_uploads")
			.select("capture_page_id, storage_path")
			.in("capture_page_id", pagesWithIncentive);

		for (const inc of incentives ?? []) {
			const { data: signed } = await supabase.storage
				.from("incentives")
				.createSignedUrl(inc.storage_path, 7 * 24 * 60 * 60); // 7 days
			if (signed?.signedUrl) {
				incentiveUrlMap.set(inc.capture_page_id, signed.signedUrl);
			}
		}
	}

	// Build send params for each pending email
	const sendable: { pendingId: string; params: SendParams }[] = [];
	const skippedIds: string[] = [];

	for (const row of pendingRows) {
		const artist = artistMap.get(row.artist_id);
		const pageId = fanToPage.get(row.fan_capture_id);
		const template = pageId ? templateMap.get(pageId) : undefined;

		if (!artist || !template || !template.is_active) {
			skippedIds.push(row.id);
			continue;
		}

		const incentiveUrl =
			template.include_incentive_link && pageId ? incentiveUrlMap.get(pageId) : undefined;

		const html = renderFollowUpHtml({
			artistName: artist.name,
			body: template.body,
			incentiveUrl,
		});

		sendable.push({
			pendingId: row.id,
			params: {
				to: row.email,
				artistId: row.artist_id,
				artistName: artist.name,
				subject: template.subject,
				html,
			},
		});
	}

	// Mark skipped emails back to pending (no template / inactive)
	if (skippedIds.length > 0) {
		await supabase.from("pending_emails").update({ status: "pending" }).in("id", skippedIds);
	}

	if (sendable.length === 0) {
		const elapsed = Math.round(performance.now() - start);
		console.log(`[send-batch] 0 sent, ${skippedIds.length} skipped, ${elapsed}ms`);
		return c.json({ sent: 0, failed: 0, skipped: skippedIds.length });
	}

	// Send via Resend batch API
	const emailService = getEmailService();
	let sentCount = 0;
	let failedCount = 0;

	try {
		const results = await emailService.sendBatch(sendable.map((s) => s.params));

		const sentIds: string[] = [];
		const failedIds: string[] = [];
		const providerUpdates: { id: string; provider_message_id: string }[] = [];

		for (let i = 0; i < results.length; i++) {
			const result = results[i];
			const pendingId = sendable[i].pendingId;

			if (result.status === "sent") {
				sentIds.push(pendingId);
				providerUpdates.push({ id: pendingId, provider_message_id: result.id });
				sentCount++;
			} else {
				// suppressed — mark as failed so it doesn't retry
				failedIds.push(pendingId);
				failedCount++;
			}
		}

		// Update sent emails with provider_message_id
		for (const update of providerUpdates) {
			await supabase
				.from("pending_emails")
				.update({ status: "sent", provider_message_id: update.provider_message_id })
				.eq("id", update.id);
		}

		// Mark suppressed as failed
		if (failedIds.length > 0) {
			await supabase.from("pending_emails").update({ status: "failed" }).in("id", failedIds);
		}
	} catch (err) {
		// Batch send failed entirely — increment retry_count, reset to pending
		failedCount = sendable.length;
		const ids = sendable.map((s) => s.pendingId);
		await supabase.rpc("increment_retry_count", { pending_ids: ids });

		console.error("[send-batch] Batch send failed:", err);
	}

	const elapsed = Math.round(performance.now() - start);
	console.log(
		`[send-batch] ${sentCount} sent, ${failedCount} failed, ${skippedIds.length} skipped, ${elapsed}ms`,
	);

	return c.json({
		sent: sentCount,
		failed: failedCount,
		skipped: skippedIds.length,
		latency_ms: elapsed,
	});
});

export default app;
