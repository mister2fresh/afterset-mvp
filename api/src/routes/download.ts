import { Hono } from "hono";
import {
	type DownloadPageStyle,
	renderDownloadPage,
	renderErrorPage,
	renderExpiredPage,
} from "../lib/download-page.js";
import { verifyDownloadToken } from "../lib/download-token.js";
import { supabase } from "../lib/supabase.js";

const app = new Hono();

type PageRow = {
	incentive_file_path: string;
	incentive_file_name: string;
	incentive_content_type: string;
	accent_color: string;
	secondary_color: string;
	bg_color: string;
	text_color: string;
	button_style: "rounded" | "pill" | "sharp";
	background_style: "solid" | "gradient" | "glow";
	streaming_links: Record<string, string>;
	social_links: Record<string, string>;
	artists: { name: string };
};

const PAGE_COLUMNS = [
	"incentive_file_path",
	"incentive_file_name",
	"incentive_content_type",
	"accent_color",
	"secondary_color",
	"bg_color",
	"text_color",
	"button_style",
	"background_style",
	"streaming_links",
	"social_links",
	"artists(name)",
].join(",");

function toStyle(page: PageRow): DownloadPageStyle {
	return {
		accentColor: page.accent_color,
		secondaryColor: page.secondary_color,
		bgColor: page.bg_color,
		textColor: page.text_color,
		buttonStyle: page.button_style,
		backgroundStyle: page.background_style,
	};
}

app.get("/:token", async (c) => {
	const result = verifyDownloadToken(c.req.param("token"));
	if (!result) {
		return c.html(renderErrorPage(), 400);
	}

	const { data: page } = await supabase
		.from("capture_pages")
		.select(PAGE_COLUMNS)
		.eq("id", result.capturePageId)
		.maybeSingle<PageRow>();

	if (result.expired) {
		const style = page ? toStyle(page) : undefined;
		const artistName = page?.artists?.name;
		return c.html(renderExpiredPage(artistName, style), 410);
	}

	if (!page?.incentive_file_path) {
		return c.html(renderErrorPage(), 404);
	}

	const { data: signed } = await supabase.storage
		.from("incentives")
		.createSignedUrl(page.incentive_file_path, 3600, { download: true });

	if (!signed?.signedUrl) {
		return c.html(renderErrorPage(), 500);
	}

	c.header("Cache-Control", "no-store");
	return c.html(
		renderDownloadPage(
			{
				artistName: page.artists.name,
				fileName: page.incentive_file_name,
				contentType: page.incentive_content_type,
				signedUrl: signed.signedUrl,
				streamingLinks: page.streaming_links,
				socialLinks: page.social_links,
			},
			toStyle(page),
		),
	);
});

export default app;
