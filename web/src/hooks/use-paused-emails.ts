import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export type PausedSkipReason = "email_cap" | "tier_locked" | "stale" | "no_plan";

export type PausedEmail = {
	id: string;
	skip_reason: PausedSkipReason;
	skip_reason_at: string | null;
	send_at: string;
	fan_email: string;
	fan_name: string | null;
	page_id: string | null;
	page_title: string | null;
	sequence_order: number | null;
	broadcast_id: string | null;
	broadcast_subject: string | null;
};

export function usePausedEmails() {
	return useQuery({
		queryKey: ["paused-emails"],
		queryFn: () => api.get<PausedEmail[]>("/paused-emails"),
		staleTime: 60_000,
	});
}

export function useDismissPausedEmails() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (reason: PausedSkipReason) => api.delete(`/paused-emails?reason=${reason}`),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["paused-emails"] });
			queryClient.invalidateQueries({ queryKey: ["usage"] });
		},
	});
}
