import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { TIER_LIMITS, type TierLimits } from "@/lib/pricing";
import type { ArtistSettings, Tier } from "@/lib/types";

type UseTierResult = {
	tier: Tier;
	effectiveTier: Tier;
	trialEndsAt: string | null;
	isTrial: boolean;
	limits: TierLimits;
	isLoading: boolean;
};

export function useTier(): UseTierResult {
	const { data, isLoading } = useQuery({
		queryKey: ["settings"],
		queryFn: () => api.get<ArtistSettings>("/settings"),
		staleTime: 60_000,
	});

	const tier = data?.tier ?? "solo";
	const effectiveTier = data?.effective_tier ?? tier;

	return {
		tier,
		effectiveTier,
		trialEndsAt: data?.trial_ends_at ?? null,
		isTrial: data?.is_trial ?? false,
		limits: TIER_LIMITS[effectiveTier],
		isLoading,
	};
}
