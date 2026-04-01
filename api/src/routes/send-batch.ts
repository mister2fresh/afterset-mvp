import { Hono } from "hono";
import { z } from "zod";
import { createDownloadToken } from "../lib/download-token.js";
import { getEmailService } from "../lib/email/index.js";
import { type EmailTheme, renderFollowUpHtml, toEmailTheme } from "../lib/email/render-template.js";
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

	// Atomically claim pending emails (SELECT + UPDATE in one step to prevent race conditions)
	let pendingRows: {
		id: string;
		fan_capture_id: string;
		artist_id: string;
		email: string;
		retry_count: number;
		email_template_id: string | null;
		broadcast_id: string | null;
	}[];

	if (parsed.data?.ids) {
		// Specific IDs requested — claim only those
		const { data, error } = await supabase
			.from("pending_emails")
			.update({ status: "sending" })
			.in("id", parsed.data.ids)
			.eq("status", "pending")
			.lte("send_at", new Date().toISOString())
			.select("id, fan_capture_id, artist_id, email, retry_count, email_template_id, broadcast_id");
		if (error) return c.json({ error: error.message }, 500);
		pendingRows = data ?? [];
	} else {
		// Normal poll — use atomic claim RPC (FOR UPDATE SKIP LOCKED)
		const { data, error } = await supabase.rpc("claim_pending_emails", {
			batch_limit: BATCH_LIMIT,
		});
		if (error) return c.json({ error: error.message }, 500);
		pendingRows = data ?? [];
	}

	if (pendingRows.length === 0) {
		return c.json({ sent: 0, failed: 0, skipped: 0 });
	}

	// Collect unique artist IDs to batch-fetch artist info
	const artistIds = [...new Set(pendingRows.map((r) => r.artist_id))];

	const { data: artists } = await supabase.from("artists").select("id, name").in("id", artistIds);

	const artistMap = new Map((artists ?? []).map((a) => [a.id, a as { id: string; name: string }]));

	// Get fan_capture_ids to find which capture_page each fan came from (needed for legacy rows + incentive URLs)
	const fanCaptureIds = [...new Set(pendingRows.map((r) => r.fan_capture_id))];

	const { data: captureEvents } = await supabase
		.from("capture_events")
		.select("fan_capture_id, capture_page_id")
		.in("fan_capture_id", fanCaptureIds);

	const fanToPage = new Map(
		(captureEvents ?? []).map((e) => [e.fan_capture_id, e.capture_page_id]),
	);

	// Fetch templates by ID for rows that have email_template_id
	const templateIds = [
		...new Set(
			pendingRows.map((r) => r.email_template_id).filter((id): id is string => id != null),
		),
	];

	const { data: templatesById } =
		templateIds.length > 0
			? await supabase
					.from("email_templates")
					.select("id, capture_page_id, subject, body, include_incentive_link, is_active")
					.in("id", templateIds)
			: { data: [] };

	const templateById = new Map((templatesById ?? []).map((t) => [t.id, t]));

	// Fetch legacy templates by page for rows without email_template_id or broadcast_id
	const legacyPageIds = [
		...new Set(
			pendingRows
				.filter((r) => r.email_template_id == null && r.broadcast_id == null)
				.map((r) => fanToPage.get(r.fan_capture_id))
				.filter((id): id is string => id != null),
		),
	];

	const { data: legacyTemplates } =
		legacyPageIds.length > 0
			? await supabase
					.from("email_templates")
					.select("id, capture_page_id, subject, body, include_incentive_link, is_active")
					.in("capture_page_id", legacyPageIds)
					.eq("sequence_order", 0)
			: { data: [] };

	const templateByPage = new Map((legacyTemplates ?? []).map((t) => [t.capture_page_id, t]));

	// Collect all page IDs referenced by templates (for incentive URLs + theming)
	const allTemplates = [...(templatesById ?? []), ...(legacyTemplates ?? [])];
	const allPageIds = [...new Set(allTemplates.map((t) => t.capture_page_id).filter(Boolean))];

	const baseUrl = process.env.API_BASE_URL ?? "https://api.afterset.net";
	const incentiveUrlMap = new Map<string, string>();
	const pageThemeMap = new Map<string, EmailTheme>();
	const pageTitleMap = new Map<string, string>();
	const pageLinksMap = new Map<
		string,
		{ streaming: Record<string, string>; social: Record<string, string> }
	>();

	if (allPageIds.length > 0) {
		const { data: pages } = await supabase
			.from("capture_pages")
			.select(
				"id, title, incentive_file_path, accent_color, bg_color, text_color, button_style, streaming_links, social_links",
			)
			.in("id", allPageIds);

		for (const page of pages ?? []) {
			pageThemeMap.set(page.id, toEmailTheme(page));
			if (page.title) pageTitleMap.set(page.id, page.title);
			if (page.incentive_file_path) {
				const token = createDownloadToken(page.id);
				incentiveUrlMap.set(page.id, `${baseUrl}/download/${token}`);
			}
			pageLinksMap.set(page.id, {
				streaming: (page.streaming_links as Record<string, string>) ?? {},
				social: (page.social_links as Record<string, string>) ?? {},
			});
		}
	}

	// Fetch broadcasts for rows that have broadcast_id
	const broadcastIds = [
		...new Set(pendingRows.map((r) => r.broadcast_id).filter((id): id is string => id != null)),
	];

	const { data: broadcastsData } =
		broadcastIds.length > 0
			? await supabase
					.from("broadcasts")
					.select("id, subject, body, reply_to")
					.in("id", broadcastIds)
			: { data: [] };

	const broadcastMap = new Map((broadcastsData ?? []).map((b) => [b.id, b]));

	// For broadcast emails, fetch each artist's most recently updated page for theming
	const broadcastArtistIds = [
		...new Set(pendingRows.filter((r) => r.broadcast_id != null).map((r) => r.artist_id)),
	];

	const artistThemeMap = new Map<string, EmailTheme>();
	const artistLinksMap = new Map<
		string,
		{ streaming: Record<string, string>; social: Record<string, string> }
	>();
	if (broadcastArtistIds.length > 0) {
		for (const artistId of broadcastArtistIds) {
			const { data: latestPage } = await supabase
				.from("capture_pages")
				.select("accent_color, bg_color, text_color, button_style, streaming_links, social_links")
				.eq("artist_id", artistId)
				.order("updated_at", { ascending: false })
				.limit(1)
				.single();

			if (latestPage) {
				artistThemeMap.set(artistId, toEmailTheme(latestPage));
				artistLinksMap.set(artistId, {
					streaming: (latestPage.streaming_links as Record<string, string>) ?? {},
					social: (latestPage.social_links as Record<string, string>) ?? {},
				});
			}
		}
	}

	// Build send params for each pending email
	const sendable: { pendingId: string; params: SendParams }[] = [];
	const skippedIds: string[] = [];

	for (const row of pendingRows) {
		const artist = artistMap.get(row.artist_id);

		// Broadcast emails — resolve from broadcasts table
		if (row.broadcast_id) {
			const broadcast = broadcastMap.get(row.broadcast_id);
			if (!artist || !broadcast) {
				skippedIds.push(row.id);
				continue;
			}
			const theme = artistThemeMap.get(row.artist_id);
			const links = artistLinksMap.get(row.artist_id);
			const html = renderFollowUpHtml({
				artistName: artist.name,
				body: broadcast.body,
				theme,
				streamingLinks: links?.streaming,
				socialLinks: links?.social,
			});
			sendable.push({
				pendingId: row.id,
				params: {
					to: row.email,
					artistId: row.artist_id,
					artistName: artist.name,
					subject: broadcast.subject,
					html,
					replyTo: broadcast.reply_to ?? undefined,
				},
			});
			continue;
		}

		// Sequence/legacy emails — resolve from templates
		const pageId = fanToPage.get(row.fan_capture_id);
		const template = row.email_template_id
			? templateById.get(row.email_template_id)
			: pageId
				? templateByPage.get(pageId)
				: undefined;

		if (!artist || !template || !template.is_active) {
			skippedIds.push(row.id);
			continue;
		}

		const capturePageId = template.capture_page_id ?? pageId;
		const incentiveUrl =
			template.include_incentive_link && capturePageId
				? incentiveUrlMap.get(capturePageId)
				: undefined;

		const theme = capturePageId ? pageThemeMap.get(capturePageId) : undefined;
		const pageTitle = capturePageId ? pageTitleMap.get(capturePageId) : undefined;
		const links = capturePageId ? pageLinksMap.get(capturePageId) : undefined;
		const html = renderFollowUpHtml({
			artistName: artist.name,
			pageTitle,
			body: template.body,
			incentiveUrl,
			theme,
			streamingLinks: links?.streaming,
			socialLinks: links?.social,
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

	// Mark skipped emails as failed (no template / inactive — retrying won't help)
	if (skippedIds.length > 0) {
		await supabase.from("pending_emails").update({ status: "failed" }).in("id", skippedIds);
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

	// Update broadcast sent_count for any broadcasts in this batch
	if (broadcastIds.length > 0) {
		for (const bId of broadcastIds) {
			const { count } = await supabase
				.from("pending_emails")
				.select("id", { count: "exact", head: true })
				.eq("broadcast_id", bId)
				.eq("status", "sent");

			await supabase
				.from("broadcasts")
				.update({ sent_count: count ?? 0 })
				.eq("id", bId);

			// If all pending emails for this broadcast are done, mark broadcast as sent
			const { count: pendingCount } = await supabase
				.from("pending_emails")
				.select("id", { count: "exact", head: true })
				.eq("broadcast_id", bId)
				.in("status", ["pending", "sending"]);

			if ((pendingCount ?? 0) === 0) {
				await supabase
					.from("broadcasts")
					.update({ status: "sent" })
					.eq("id", bId)
					.in("status", ["sending", "scheduled"]);
			}
		}
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
