import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { getUser } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/settings")({
	component: SettingsPage,
});

type ArtistSettings = {
	id: string;
	name: string;
	email: string;
	timezone: string;
};

const COMMON_TIMEZONES = [
	"America/New_York",
	"America/Chicago",
	"America/Denver",
	"America/Los_Angeles",
	"America/Anchorage",
	"Pacific/Honolulu",
	"America/Phoenix",
	"America/Toronto",
	"America/Vancouver",
	"Europe/London",
	"Europe/Paris",
	"Europe/Berlin",
	"Asia/Tokyo",
	"Asia/Shanghai",
	"Australia/Sydney",
];

function getAllTimezones(): string[] {
	try {
		return Intl.supportedValuesOf("timeZone");
	} catch {
		return COMMON_TIMEZONES;
	}
}

function SettingsPage() {
	const user = getUser();
	const queryClient = useQueryClient();

	const { data: settings, isLoading } = useQuery({
		queryKey: ["settings"],
		queryFn: () => api.get<ArtistSettings>("/settings"),
	});

	const [name, setName] = useState<string | null>(null);
	const [timezone, setTimezone] = useState<string | null>(null);

	const displayName = name ?? settings?.name ?? "";
	const displayTz = timezone ?? settings?.timezone ?? "America/New_York";

	const hasChanges =
		(name !== null && name !== settings?.name) ||
		(timezone !== null && timezone !== settings?.timezone);

	const mutation = useMutation({
		mutationFn: (updates: { name?: string; timezone?: string }) =>
			api.patch<ArtistSettings>("/settings", updates),
		onSuccess: (data) => {
			queryClient.setQueryData(["settings"], data);
			setName(null);
			setTimezone(null);
		},
	});

	function handleSave() {
		const updates: { name?: string; timezone?: string } = {};
		if (name !== null && name !== settings?.name) updates.name = name;
		if (timezone !== null && timezone !== settings?.timezone) updates.timezone = timezone;
		mutation.mutate(updates);
	}

	const detectedTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
	const showDetected = settings && settings.timezone !== detectedTz && timezone === null;

	const allTimezones = getAllTimezones();

	return (
		<div className="max-w-2xl space-y-6">
			<Card>
				<CardHeader>
					<CardTitle>Account</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4">
					<div>
						<p className="text-sm text-muted-foreground">Email</p>
						<p className="text-sm">{user?.email}</p>
					</div>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Profile</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4">
					{isLoading ? (
						<p className="text-sm text-muted-foreground">Loading...</p>
					) : (
						<>
							<div className="space-y-2">
								<Label htmlFor="artist-name">Artist / Band Name</Label>
								<Input
									id="artist-name"
									value={displayName}
									onChange={(e) => setName(e.target.value)}
									placeholder="Your artist name"
								/>
								<p className="text-xs text-muted-foreground">
									Used in follow-up emails sent to fans.
								</p>
							</div>

							<div className="space-y-2">
								<Label htmlFor="timezone">Timezone</Label>
								<select
									id="timezone"
									value={displayTz}
									onChange={(e) => setTimezone(e.target.value)}
									className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
								>
									{allTimezones.map((tz) => (
										<option key={tz} value={tz}>
											{tz.replace(/_/g, " ")}
										</option>
									))}
								</select>
								<p className="text-xs text-muted-foreground">
									Controls when "next morning" follow-up emails are sent (9 AM in your timezone).
								</p>
								{showDetected && (
									<Button
										type="button"
										variant="outline"
										size="sm"
										onClick={() => setTimezone(detectedTz)}
									>
										Use detected timezone: {detectedTz.replace(/_/g, " ")}
									</Button>
								)}
							</div>

							{hasChanges && (
								<Button onClick={handleSave} disabled={mutation.isPending}>
									{mutation.isPending ? "Saving..." : "Save Changes"}
								</Button>
							)}

							{mutation.isError && (
								<p className="text-sm text-red-400">Failed to save: {mutation.error.message}</p>
							)}
						</>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
