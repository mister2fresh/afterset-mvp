export type Broadcast = {
	id: string;
	artist_id: string;
	subject: string;
	body: string;
	reply_to: string | null;
	status: "draft" | "scheduled" | "sending" | "sent" | "failed";
	scheduled_at: string | null;
	filter_page_ids: string[] | null;
	filter_date_from: string | null;
	filter_date_to: string | null;
	filter_method: string | null;
	recipient_count: number;
	sent_count: number;
	opened_count: number;
	archived_at: string | null;
	created_at: string;
	updated_at: string;
};

export type Tier = "solo" | "tour" | "superstar";

export type ArtistSettings = {
	id: string;
	name: string;
	email: string;
	timezone: string;
	onboarding_completed: boolean;
	tier: Tier;
	trial_ends_at: string | null;
	effective_tier: Tier;
	is_trial: boolean;
};
