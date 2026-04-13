import { Resend } from "resend";
import { filterSuppressed, isSuppressed } from "./suppression.js";
import type { EmailService, SendParams, SendResult } from "./types.js";
import { createUnsubscribeToken } from "./unsubscribe-token.js";

const FROM_DOMAIN = "send.afterset.net";

function getBaseUrl(): string {
	return process.env.API_BASE_URL ?? "http://localhost:3000";
}

function getAddress(): string {
	return process.env.CAN_SPAM_ADDRESS ?? "";
}

function buildFooter(address: string, unsubscribeUrl: string): string {
	return `<div style="margin-top:32px;padding-top:16px;border-top:1px solid #333;font-size:12px;color:#888;text-align:center;">
<p>You received this because you signed up at a live event via Afterset.</p>
<p><a href="${unsubscribeUrl}" style="color:#888;text-decoration:underline;">Unsubscribe</a></p>
<p>${address}</p>
</div>`;
}

function buildHeaders(token: string): Record<string, string> {
	const url = `${getBaseUrl()}/api/email/unsubscribe?token=${token}`;
	return {
		"List-Unsubscribe": `<${url}>`,
		"List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
	};
}

function buildFrom(artistName: string, replyTo: string | undefined): string {
	const localPart = replyTo ? "hello" : "noreply";
	return `${artistName} via Afterset <${localPart}@${FROM_DOMAIN}>`;
}

export class ResendEmailService implements EmailService {
	private readonly resend: Resend;

	constructor(apiKey: string) {
		this.resend = new Resend(apiKey);
	}

	get client(): Resend {
		return this.resend;
	}

	async send(params: SendParams): Promise<SendResult> {
		if (await isSuppressed(params.to, params.artistId)) {
			return { id: "", status: "suppressed" };
		}

		const token = createUnsubscribeToken(params.to, params.artistId);
		const unsubUrl = `${getBaseUrl()}/api/email/unsubscribe?token=${token}`;
		const { data, error } = await this.resend.emails.send({
			from: buildFrom(params.artistName, params.replyTo),
			to: [params.to],
			subject: params.subject,
			html: params.html + buildFooter(getAddress(), unsubUrl),
			headers: buildHeaders(token),
			...(params.replyTo && { replyTo: [params.replyTo] }),
		});

		if (error || !data) throw new Error(`Resend error: ${error?.message ?? "No data returned"}`);
		return { id: data.id, status: "sent" };
	}

	async sendBatch(params: SendParams[]): Promise<SendResult[]> {
		if (params.length === 0) return [];

		const artistId = params[0].artistId;
		const allEmails = params.map((p) => p.to);
		const suppressed = await filterSuppressed(allEmails, artistId);

		const unsuppressed = params.filter((p) => !suppressed.has(p.to));
		if (unsuppressed.length === 0) {
			return params.map(() => ({ id: "", status: "suppressed" as const }));
		}

		const payload = unsuppressed.map((p) => {
			const token = createUnsubscribeToken(p.to, p.artistId);
			const unsubUrl = `${getBaseUrl()}/api/email/unsubscribe?token=${token}`;
			return {
				from: buildFrom(p.artistName, p.replyTo),
				to: [p.to],
				subject: p.subject,
				html: p.html + buildFooter(getAddress(), unsubUrl),
				headers: buildHeaders(token),
				...(p.replyTo && { replyTo: [p.replyTo] }),
			};
		});

		const { data, error } = await this.resend.batch.send(payload);
		if (error || !data) {
			throw new Error(`Resend batch error: ${error?.message ?? "No data returned"}`);
		}

		const sentMap = new Map<string, string>();
		for (let i = 0; i < unsuppressed.length; i++) {
			sentMap.set(unsuppressed[i].to, data.data[i].id);
		}

		return params.map((p) => {
			const id = sentMap.get(p.to);
			return id ? { id, status: "sent" as const } : { id: "", status: "suppressed" as const };
		});
	}
}
