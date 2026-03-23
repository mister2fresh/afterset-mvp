import { describe, expect, it } from "vitest";
import { generateCaptureHtml } from "./capture-template.js";

function basePage(overrides = {}) {
	return {
		slug: "test-page",
		title: "Test Show",
		value_exchange_text: "Get exclusive updates",
		accent_color: "#E8C547",
		secondary_color: "#D4A017",
		background_style: "solid" as const,
		button_style: "rounded" as const,
		streaming_links: {} as Record<string, string>,
		social_links: {} as Record<string, string>,
		incentive_file_name: null as string | null,
		incentive_content_type: null as string | null,
		...overrides,
	};
}

describe("generateCaptureHtml", () => {
	it("returns valid HTML document", () => {
		const html = generateCaptureHtml(basePage());
		expect(html).toMatch(/^<!DOCTYPE html>/);
		expect(html).toContain("</html>");
		expect(html).toContain('<html lang="en">');
	});

	it("includes title in heading and page title", () => {
		const html = generateCaptureHtml(basePage({ title: "My Great Show" }));
		expect(html).toContain("<title>My Great Show</title>");
		expect(html).toContain("<h1>My Great Show</h1>");
	});

	it("escapes HTML in title", () => {
		const html = generateCaptureHtml(basePage({ title: '<script>alert("xss")</script>' }));
		expect(html).not.toContain("<script>alert");
		expect(html).toContain("&lt;script&gt;");
	});

	it("includes value exchange text when provided", () => {
		const html = generateCaptureHtml(basePage({ value_exchange_text: "Free download!" }));
		expect(html).toContain("Free download!");
		expect(html).toContain('class="sub"');
	});

	it("omits subtitle when value_exchange_text is null", () => {
		const html = generateCaptureHtml(basePage({ value_exchange_text: null }));
		expect(html).not.toContain('class="sub"');
	});

	it("uses system font stack", () => {
		const html = generateCaptureHtml(basePage());
		expect(html).toContain("-apple-system,BlinkMacSystemFont");
		expect(html).not.toContain("Bricolage");
		expect(html).not.toContain("DM Sans");
	});

	it("applies solid background", () => {
		const html = generateCaptureHtml(basePage({ background_style: "solid" }));
		expect(html).toContain("background:#0a0e1a");
	});

	it("applies gradient background using secondary color", () => {
		const html = generateCaptureHtml(
			basePage({ background_style: "gradient", secondary_color: "#D4A017" }),
		);
		expect(html).toContain("linear-gradient");
		expect(html).toContain("#D4A01726");
	});

	it("applies glow background using accent color", () => {
		const html = generateCaptureHtml(
			basePage({ background_style: "glow", accent_color: "#E8C547" }),
		);
		expect(html).toContain("radial-gradient");
		expect(html).toContain("#E8C5471A");
	});

	it("applies rounded button style", () => {
		const html = generateCaptureHtml(basePage({ button_style: "rounded" }));
		expect(html).toContain("border-radius:6px");
	});

	it("applies pill button style", () => {
		const html = generateCaptureHtml(basePage({ button_style: "pill" }));
		expect(html).toContain("border-radius:9999px");
	});

	it("applies sharp button style", () => {
		const html = generateCaptureHtml(basePage({ button_style: "sharp" }));
		expect(html).toContain("border-radius:0");
	});

	it("uses accent color for button and input focus", () => {
		const html = generateCaptureHtml(basePage({ accent_color: "#FF0000" }));
		expect(html).toContain("background:#FF0000");
		expect(html).toContain("border-color:#FF0000");
	});

	it("renders streaming link icons", () => {
		const html = generateCaptureHtml(
			basePage({
				streaming_links: { spotify: "https://open.spotify.com/artist/123" },
			}),
		);
		expect(html).toContain('aria-label="Spotify"');
		expect(html).toContain("open.spotify.com/artist/123");
		expect(html).toContain("<svg");
	});

	it("renders social link icons", () => {
		const html = generateCaptureHtml(
			basePage({
				social_links: { instagram: "https://instagram.com/test" },
			}),
		);
		expect(html).toContain('aria-label="Instagram"');
		expect(html).toContain("instagram.com/test");
	});

	it("skips empty streaming links", () => {
		const html = generateCaptureHtml(
			basePage({
				streaming_links: { spotify: "", apple_music: "  " },
			}),
		);
		expect(html).not.toContain('aria-label="Spotify"');
		expect(html).not.toContain('aria-label="Apple Music"');
	});

	it("skips unknown platform keys", () => {
		const html = generateCaptureHtml(
			basePage({
				streaming_links: { napster: "https://napster.com/artist" },
			}),
		);
		expect(html).not.toContain("napster.com");
	});

	it("includes email form with correct attributes", () => {
		const html = generateCaptureHtml(basePage());
		expect(html).toContain('type="email"');
		expect(html).toContain('inputmode="email"');
		expect(html).toContain('autocomplete="email"');
		expect(html).toContain("required");
	});

	it("embeds slug in form submission script", () => {
		const html = generateCaptureHtml(basePage({ slug: "my-cool-show" }));
		expect(html).toContain('S="my-cool-show"');
	});

	it("includes entry method tracking from query param", () => {
		const html = generateCaptureHtml(basePage());
		expect(html).toContain('p.get("v")||"d"');
	});

	it("includes build timestamp comment", () => {
		const html = generateCaptureHtml(basePage());
		expect(html).toMatch(/<!-- built: \d{4}-\d{2}-\d{2}T/);
	});

	it("shows generic confirmation when no incentive", () => {
		const html = generateCaptureHtml(basePage());
		expect(html).toContain("You're in!");
		expect(html).toContain("We&#39;ll be in touch soon.");
	});

	it("shows incentive-specific confirmation for audio", () => {
		const html = generateCaptureHtml(
			basePage({
				incentive_file_name: "track.mp3",
				incentive_content_type: "audio/mpeg",
			}),
		);
		expect(html).toContain("send a track to your inbox");
	});

	it("shows incentive-specific confirmation for video", () => {
		const html = generateCaptureHtml(
			basePage({
				incentive_file_name: "clip.mp4",
				incentive_content_type: "video/mp4",
			}),
		);
		expect(html).toContain("send a video to your inbox");
	});

	it("shows incentive-specific confirmation for PDF", () => {
		const html = generateCaptureHtml(
			basePage({
				incentive_file_name: "setlist.pdf",
				incentive_content_type: "application/pdf",
			}),
		);
		expect(html).toContain("send a PDF to your inbox");
	});

	it("uses localStorage key for offline queue", () => {
		const html = generateCaptureHtml(basePage());
		expect(html).toContain("afterset_q");
		expect(html).toContain("localStorage");
	});

	it("uses keepalive and AbortController in fetch", () => {
		const html = generateCaptureHtml(basePage());
		expect(html).toContain("keepalive:true");
		expect(html).toContain("AbortController");
	});

	it("has 48px minimum touch targets on button", () => {
		const html = generateCaptureHtml(basePage());
		expect(html).toContain("min-height:48px");
		expect(html).toContain("min-width:48px");
	});

	it("stays under 14KB TCP window budget", () => {
		const maxPage = basePage({
			title: "A".repeat(100),
			value_exchange_text: "B".repeat(500),
			streaming_links: {
				spotify: "https://open.spotify.com/artist/xxxxxxxxxx",
				apple_music: "https://music.apple.com/artist/xxxxxxxxxx",
				youtube_music: "https://music.youtube.com/channel/xxxxxxxxxx",
				soundcloud: "https://soundcloud.com/xxxxxxxxxx",
				tidal: "https://tidal.com/artist/xxxxxxxxxx",
				bandcamp: "https://xxxxxxxxxx.bandcamp.com",
			},
			social_links: {
				instagram: "https://instagram.com/xxxxxxxxxx",
				tiktok: "https://tiktok.com/@xxxxxxxxxx",
				twitter: "https://x.com/xxxxxxxxxx",
				youtube: "https://youtube.com/@xxxxxxxxxx",
				facebook: "https://facebook.com/xxxxxxxxxx",
			},
		});
		const html = generateCaptureHtml(maxPage);
		expect(html.length).toBeLessThan(14_336);
	});

	it("escapes HTML in streaming link URLs", () => {
		const html = generateCaptureHtml(
			basePage({
				streaming_links: { spotify: 'https://evil.com/"onmouseover="alert(1)' },
			}),
		);
		expect(html).not.toContain('"onmouseover=');
		expect(html).toContain("&quot;onmouseover=");
	});
});
