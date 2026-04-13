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

/** Returns UTC ISO boundaries for the current calendar month in a given timezone. */
export function getMonthRange(tz: string): { start: string; end: string } {
	const now = new Date();
	const ymd = now.toLocaleDateString("en-CA", { timeZone: tz });
	const [year, month] = ymd.split("-").map(Number);
	const utcStr = now.toLocaleString("en-US", { timeZone: "UTC" });
	const tzStr = now.toLocaleString("en-US", { timeZone: tz });
	const offsetMs = new Date(utcStr).getTime() - new Date(tzStr).getTime();
	const firstOfMonth = `${year}-${String(month).padStart(2, "0")}-01T00:00:00Z`;
	const nextMonthYear = month === 12 ? year + 1 : year;
	const nextMonth = month === 12 ? 1 : month + 1;
	const firstOfNext = `${nextMonthYear}-${String(nextMonth).padStart(2, "0")}-01T00:00:00Z`;
	return {
		start: new Date(new Date(firstOfMonth).getTime() + offsetMs).toISOString(),
		end: new Date(new Date(firstOfNext).getTime() + offsetMs).toISOString(),
	};
}
