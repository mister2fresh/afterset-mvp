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

export function getAllTimezones(): string[] {
	try {
		return Intl.supportedValuesOf("timeZone");
	} catch {
		return COMMON_TIMEZONES;
	}
}
