/** Returns UTC ISO boundaries for "today" in a given timezone. */
export function getTodayRange(tz: string): { start: string; end: string } {
	const now = new Date();
	const todayStr = now.toLocaleDateString("en-CA", { timeZone: tz });
	const utcStr = now.toLocaleString("en-US", { timeZone: "UTC" });
	const tzStr = now.toLocaleString("en-US", { timeZone: tz });
	const offsetMs = new Date(utcStr).getTime() - new Date(tzStr).getTime();
	const startMs = new Date(`${todayStr}T00:00:00Z`).getTime() + offsetMs;
	return {
		start: new Date(startMs).toISOString(),
		end: new Date(startMs + 86_400_000).toISOString(),
	};
}
