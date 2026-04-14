import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Tier } from "@/lib/types";

export type PausedByReason = {
	email_cap: number;
	tier_locked: number;
	stale: number;
	no_plan: number;
};

export type UsageResponse = {
	tier: Tier;
	effective_tier: Tier;
	is_trial: boolean;
	fans: {
		used: number;
		limit: number | null;
		cap_exceeded_count: number;
	};
	emails: {
		used: number;
		limit: number;
		paused_count: number;
		paused_by_reason: PausedByReason;
	};
	broadcasts: {
		used: number;
		limit: number | null;
	};
	storage: {
		used_mb: number;
		limit_mb: number;
	};
};

export function useUsage() {
	return useQuery({
		queryKey: ["usage"],
		queryFn: () => api.get<UsageResponse>("/usage"),
		staleTime: 60_000,
	});
}
