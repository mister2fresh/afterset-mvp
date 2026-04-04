import { ResendEmailService } from "./resend-service.js";
import type { EmailService } from "./types.js";

export { addSuppression } from "./suppression.js";
export { verifyUnsubscribeToken } from "./unsubscribe-token.js";

let instance: EmailService | null = null;

export function getEmailService(): EmailService {
	if (!instance) {
		const key = process.env.RESEND_API_KEY;
		if (!key) throw new Error("Missing RESEND_API_KEY");
		instance = new ResendEmailService(key);
	}
	return instance;
}

export function getResendClient() {
	const service = getEmailService();
	if (!(service instanceof ResendEmailService)) {
		throw new Error("Email service is not ResendEmailService");
	}
	return service.client;
}
