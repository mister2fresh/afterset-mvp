import { timingSafeEqual } from "node:crypto";
import { Hono } from "hono";
import { z } from "zod";
import { createDownloadToken } from "../lib/download-token.js";
import { getEmailService } from "../lib/email/index.js";
import { type EmailTheme, renderFollowUpHtml, toEmailTheme } from "../lib/email/render-template.js";
import type { SendParams } from "../lib/email/types.js";
import { supabase } from "../lib/supabase.js";
import { getEffectiveTier, getTierLimits, type Tier } from "../lib/tier.js";
import { getMonthRange } from "../lib/timezone.js";

const app = new Hono();

const BATCH_LIMIT = 50;

const requestSchema = z.object({
	ids: z.array(z.string().uuid()).min(1).max(BATCH_LIMIT).optional(),
});

type PendingRow = {
	id: string;
	fan_capture_id: string;
	artist_id: string;
	email: string;
	retry_count: number;
	email_template_id: string | null;
	broadcast_id: string | null;
};

// Mark pending rows older than 7 days as stale. They're not claimable (claim_pending_emails
// filters send_at > now() - 7d) but we surface them in usage meters / paused banners.
async function markStaleRows(): Promise<void> {
	const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
	await supabase
		.from("pending_emails")
		.update({ skip_reason: "stale", skip_reason_at: new Date().toISOString() })
		.eq("status", "pending")
		.lt("send_at", sevenDaysAgo)
		.is("skip_reason", null);
}

type TierArtistRow = { id: string; tier: Tier; trial_ends_at: string | null; timezone: string };

type PartitionResult = {
	sendable: PendingRow[];
	emailCapIds: string[];
	tierLockedIds: string[];
};

// Release skipped rows back to 'pending' with a skip_reason so the next eligible run retries.
async function releaseSkipped(ids: string[], reason: "email_cap" | "tier_locked"): Promise<void> {
	if (ids.length === 0) return;
	await supabase
		.from("pending_emails")
		.update({
			status: "pending",
			skip_reason: reason,
			skip_reason_at: new Date().toISOString(),
		})
		.in("id", ids);
}

async function partitionByTier(rows: PendingRow[]): Promise<PartitionResult> {
	const artistIds = [...new Set(rows.map((r) => r.artist_id))];
	const { data: artists } = await supabase
		.from("artists")
		.select("id, tier, trial_ends_at, timezone")
		.in("id", artistIds);
	const artistMap = new Map<string, TierArtistRow>(
		(artists ?? []).map((a) => [a.id, a as TierArtistRow]),
	);

	const templateIds = [
		...new Set(rows.map((r) => r.email_template_id).filter((id): id is string => id != null)),
	];
	const { data: templates } =
		templateIds.length > 0
			? await supabase.from("email_templates").select("id, sequence_order").in("id", templateIds)
			: { data: [] };
	const sequenceOrderMap = new Map<string, number>(
		(templates ?? []).map((t) => [t.id, t.sequence_order]),
	);

	// Per-artist monthly sent count (only for artists with finite email cap).
	const sentCountByArtist = new Map<string, number>();
	await Promise.all(
		artistIds.map(async (artistId) => {
			const artist = artistMap.get(artistId);
			if (!artist) return;
			const tier = getEffectiveTier(artist);
			const cap = getTierLimits(tier).emailCap;
			if (!Number.isFinite(cap)) return;
			const { start } = getMonthRange(artist.timezone ?? "America/New_York");
			const { count } = await supabase
				.from("pending_emails")
				.select("id", { count: "exact", head: true })
				.eq("artist_id", artistId)
				.eq("status", "sent")
				.gte("updated_at", start);
			sentCountByArtist.set(artistId, count ?? 0);
		}),
	);

	const sendable: PendingRow[] = [];
	const emailCapIds: string[] = [];
	const tierLockedIds: string[] = [];
	const perArtistAdded = new Map<string, number>();

	for (const row of rows) {
		const artist = artistMap.get(row.artist_id);
		if (!artist) {
			// No artist row means the send path will fail anyway — let it fall through
			// and be handled by the existing "no template" skip.
			sendable.push(row);
			continue;
		}
		const tier = getEffectiveTier(artist);
		const limits = getTierLimits(tier);

		// Tier-locked: sequence email whose step is beyond the tier's depth.
		if (row.email_template_id) {
			const seqOrder = sequenceOrderMap.get(row.email_template_id);
			if (seqOrder !== undefined && seqOrder >= limits.sequenceDepth) {
				tierLockedIds.push(row.id);
				continue;
			}
		}

		// Email cap: artist already over monthly cap, or this row would push them over.
		if (Number.isFinite(limits.emailCap)) {
			const alreadySent = sentCountByArtist.get(row.artist_id) ?? 0;
			const addedThisBatch = perArtistAdded.get(row.artist_id) ?? 0;
			if (alreadySent + addedThisBatch >= limits.emailCap) {
				emailCapIds.push(row.id);
				continue;
			}
			perArtistAdded.set(row.artist_id, addedThisBatch + 1);
		}

		sendable.push(row);
	}

	return { sendable, emailCapIds, tierLockedIds };
}

async function claimPendingRows(ids?: string[]): Promise<PendingRow[] | { error: string }> {
	if (ids) {
		const { data, error } = await supabase
			.from("pending_emails")
			.update({ status: "sending" })
			.in("id", ids)
			.eq("status", "pending")
			.lte("send_at", new Date().toISOString())
			.select("id, fan_capture_id, artist_id, email, retry_count, email_template_id, broadcast_id");
		if (error) {
			console.error(error);
			return { error: "Internal server error" };
		}
		return data ?? [];
	}
	const { data, error } = await supabase.rpc("claim_pending_emails", {
		batch_limit: BATCH_LIMIT,
	});
	if (error) {
		console.error(error);
		return { error: "Internal server error" };
	}
	return data ?? [];
}

type SendContext = {
	artistMap: Map<string, { id: string; name: string }>;
	fanToPage: Map<string, string>;
	templateById: Map<string, TemplateRow>;
	templateByPage: Map<string, TemplateRow>;
	incentiveUrlMap: Map<string, string>;
	pageThemeMap: Map<string, EmailTheme>;
	pageTitleMap: Map<string, string>;
	pageLinksMap: Map<string, { streaming: Record<string, string>; social: Record<string, string> }>;
	broadcastMap: Map<string, { id: string; subject: string; body: string; reply_to: string | null }>;
	artistThemeMap: Map<string, EmailTheme>;
	artistLinksMap: Map<
		string,
		{ streaming: Record<string, string>; social: Record<string, string> }
	>;
};

type TemplateRow = {
	id: string;
	capture_page_id: string;
	subject: string;
	body: string;
	include_incentive_link: boolean;
	is_active: boolean;
};

async function resolveSendContext(rows: PendingRow[]): Promise<SendContext> {
	// Batch-fetch artist info
	const artistIds = [...new Set(rows.map((r) => r.artist_id))];
	const { data: artists } = await supabase.from("artists").select("id, name").in("id", artistIds);
	const artistMap = new Map((artists ?? []).map((a) => [a.id, a as { id: string; name: string }]));

	// Map fan_capture_id → capture_page_id
	const fanCaptureIds = [...new Set(rows.map((r) => r.fan_capture_id))];
	const { data: captureEvents } = await supabase
		.from("capture_events")
		.select("fan_capture_id, capture_page_id")
		.in("fan_capture_id", fanCaptureIds);
	const fanToPage = new Map(
		(captureEvents ?? []).map((e) => [e.fan_capture_id, e.capture_page_id]),
	);

	// Fetch templates by ID
	const templateIds = [
		...new Set(rows.map((r) => r.email_template_id).filter((id): id is string => id != null)),
	];
	const { data: templatesById } =
		templateIds.length > 0
			? await supabase
					.from("email_templates")
					.select("id, capture_page_id, subject, body, include_incentive_link, is_active")
					.in("id", templateIds)
			: { data: [] };
	const templateById = new Map((templatesById ?? []).map((t) => [t.id, t]));

	// Legacy templates (rows without email_template_id or broadcast_id)
	const legacyPageIds = [
		...new Set(
			rows
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

	// Page themes, incentive URLs, titles, links
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

	// Broadcasts
	const broadcastIds = [
		...new Set(rows.map((r) => r.broadcast_id).filter((id): id is string => id != null)),
	];
	const { data: broadcastsData } =
		broadcastIds.length > 0
			? await supabase
					.from("broadcasts")
					.select("id, subject, body, reply_to")
					.in("id", broadcastIds)
			: { data: [] };
	const broadcastMap = new Map((broadcastsData ?? []).map((b) => [b.id, b]));

	// Broadcast artist themes (most recently updated page per artist)
	const broadcastArtistIds = [
		...new Set(rows.filter((r) => r.broadcast_id != null).map((r) => r.artist_id)),
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

	return {
		artistMap,
		fanToPage,
		templateById,
		templateByPage,
		incentiveUrlMap,
		pageThemeMap,
		pageTitleMap,
		pageLinksMap,
		broadcastMap,
		artistThemeMap,
		artistLinksMap,
	};
}

function buildSendParams(
	rows: PendingRow[],
	ctx: SendContext,
): { sendable: { pendingId: string; params: SendParams }[]; skippedIds: string[] } {
	const sendable: { pendingId: string; params: SendParams }[] = [];
	const skippedIds: string[] = [];

	for (const row of rows) {
		const artist = ctx.artistMap.get(row.artist_id);

		// Broadcast emails
		if (row.broadcast_id) {
			const broadcast = ctx.broadcastMap.get(row.broadcast_id);
			if (!artist || !broadcast) {
				skippedIds.push(row.id);
				continue;
			}
			const theme = ctx.artistThemeMap.get(row.artist_id);
			const links = ctx.artistLinksMap.get(row.artist_id);
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

		// Sequence/legacy emails
		const pageId = ctx.fanToPage.get(row.fan_capture_id);
		const template = row.email_template_id
			? ctx.templateById.get(row.email_template_id)
			: pageId
				? ctx.templateByPage.get(pageId)
				: undefined;

		if (!artist || !template || !template.is_active) {
			skippedIds.push(row.id);
			continue;
		}

		const capturePageId = template.capture_page_id ?? pageId;
		const incentiveUrl =
			template.include_incentive_link && capturePageId
				? ctx.incentiveUrlMap.get(capturePageId)
				: undefined;

		const theme = capturePageId ? ctx.pageThemeMap.get(capturePageId) : undefined;
		const pageTitle = capturePageId ? ctx.pageTitleMap.get(capturePageId) : undefined;
		const links = capturePageId ? ctx.pageLinksMap.get(capturePageId) : undefined;
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

	return { sendable, skippedIds };
}

async function updateBroadcastStats(broadcastIds: string[]): Promise<void> {
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
	if (!expected || !secret) {
		return c.json({ error: "Unauthorized" }, 401);
	}
	const secretBuf = Buffer.from(secret);
	const expectedBuf = Buffer.from(expected);
	if (secretBuf.length !== expectedBuf.length || !timingSafeEqual(secretBuf, expectedBuf)) {
		return c.json({ error: "Unauthorized" }, 401);
	}

	const body = await c.req.json().catch(() => ({}));
	const parsed = requestSchema.safeParse(body);
	if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

	await markStaleRows();

	const claimed = await claimPendingRows(parsed.data?.ids);
	if ("error" in claimed) return c.json({ error: claimed.error }, 500);
	if (claimed.length === 0) return c.json({ sent: 0, failed: 0, skipped: 0 });

	// Tier-aware partition: release rows that shouldn't send this run.
	const { sendable: eligible, emailCapIds, tierLockedIds } = await partitionByTier(claimed);
	await Promise.all([
		releaseSkipped(emailCapIds, "email_cap"),
		releaseSkipped(tierLockedIds, "tier_locked"),
	]);
	const tierSkipCount = emailCapIds.length + tierLockedIds.length;

	if (eligible.length === 0) {
		const elapsed = Math.round(performance.now() - start);
		console.log(`[send-batch] 0 sent, ${tierSkipCount} tier-skipped, ${elapsed}ms`);
		return c.json({ sent: 0, failed: 0, skipped: tierSkipCount });
	}

	const ctx = await resolveSendContext(eligible);
	const { sendable, skippedIds } = buildSendParams(eligible, ctx);

	// Mark skipped emails as failed (no template / inactive — retrying won't help)
	if (skippedIds.length > 0) {
		await supabase.from("pending_emails").update({ status: "failed" }).in("id", skippedIds);
	}

	if (sendable.length === 0) {
		const totalSkipped = skippedIds.length + tierSkipCount;
		const elapsed = Math.round(performance.now() - start);
		console.log(`[send-batch] 0 sent, ${totalSkipped} skipped, ${elapsed}ms`);
		return c.json({ sent: 0, failed: 0, skipped: totalSkipped });
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
				failedIds.push(pendingId);
				failedCount++;
			}
		}

		// Update sent emails with provider_message_id + clear any prior skip_reason
		await Promise.all(
			providerUpdates.map((update) =>
				supabase
					.from("pending_emails")
					.update({
						status: "sent",
						provider_message_id: update.provider_message_id,
						skip_reason: null,
						skip_reason_at: null,
					})
					.eq("id", update.id),
			),
		);

		if (failedIds.length > 0) {
			await supabase.from("pending_emails").update({ status: "failed" }).in("id", failedIds);
		}
	} catch (err) {
		failedCount = sendable.length;
		const ids = sendable.map((s) => s.pendingId);
		await supabase.rpc("increment_retry_count", { pending_ids: ids });
		console.error("[send-batch] Batch send failed:", err);
	}

	// Update broadcast stats
	const broadcastIds = [
		...new Set(claimed.map((r) => r.broadcast_id).filter((id): id is string => id != null)),
	];
	if (broadcastIds.length > 0) {
		await updateBroadcastStats(broadcastIds);
	}

	const totalSkipped = skippedIds.length + tierSkipCount;
	const elapsed = Math.round(performance.now() - start);
	console.log(
		`[send-batch] ${sentCount} sent, ${failedCount} failed, ${totalSkipped} skipped, ${elapsed}ms`,
	);

	return c.json({
		sent: sentCount,
		failed: failedCount,
		skipped: totalSkipped,
		latency_ms: elapsed,
	});
});

export default app;
