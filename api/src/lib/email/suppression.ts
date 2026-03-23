import { supabase } from "../supabase.js";

type SuppressionReason = "hard_bounce" | "complaint" | "manual_unsubscribe";

export async function isSuppressed(email: string, artistId: string): Promise<boolean> {
	const { data } = await supabase
		.from("email_suppression_list")
		.select("id")
		.eq("artist_id", artistId)
		.eq("email", email)
		.limit(1)
		.single();
	return data !== null;
}

export async function addSuppression(
	email: string,
	artistId: string,
	reason: SuppressionReason,
): Promise<void> {
	await supabase
		.from("email_suppression_list")
		.upsert({ artist_id: artistId, email, reason }, { onConflict: "artist_id,email" });
}

export async function filterSuppressed(emails: string[], artistId: string): Promise<Set<string>> {
	const { data } = await supabase
		.from("email_suppression_list")
		.select("email")
		.eq("artist_id", artistId)
		.in("email", emails);
	return new Set((data ?? []).map((row) => row.email));
}
