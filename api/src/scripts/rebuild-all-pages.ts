import { buildPage } from "../lib/build-page.js";
import { supabase } from "../lib/supabase.js";

const { data: pages, error } = await supabase.from("capture_pages").select("id, artist_id, slug");

if (error) {
	console.error("Failed to fetch pages:", error.message);
	process.exit(1);
}

console.log(`Rebuilding ${pages.length} page(s)...`);

for (const page of pages) {
	try {
		const result = await buildPage(page.id, page.artist_id);
		console.log(`  ${result.slug} — HTML ${result.size}B + QR uploaded`);
	} catch (err) {
		console.error(`  ${page.slug} — FAILED:`, err);
	}
}

console.log("Done.");
