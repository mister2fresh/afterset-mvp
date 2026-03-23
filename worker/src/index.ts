interface Env {
	PAGES: R2Bucket;
}

function notFound(): Response {
	return new Response(
		`<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Not Found</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;min-height:100dvh;display:flex;align-items:center;justify-content:center;background:#0a0e1a;color:#9ca3af;text-align:center}h1{font-size:1.25rem;font-weight:600;color:#f9fafb;margin-bottom:8px}p{font-size:.875rem}</style></head><body><div><h1>Page not found</h1><p>This capture page doesn\u2019t exist.</p></div></body></html>`,
		{
			status: 404,
			headers: { "Content-Type": "text/html; charset=utf-8" },
		},
	);
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url);
		const { pathname } = url;

		if (request.method !== "GET" && request.method !== "HEAD") {
			return new Response("Method Not Allowed", { status: 405 });
		}

		const match = pathname.match(/^\/c\/([a-z0-9][a-z0-9-]*[a-z0-9]?)(?:\/)?$/);
		if (!match) {
			return notFound();
		}

		const slug = match[1];
		const object = await env.PAGES.get(`c/${slug}/index.html`);
		if (!object) {
			return notFound();
		}

		const headers = new Headers();
		object.writeHttpMetadata(headers);
		headers.set("ETag", object.httpEtag);
		headers.delete("Content-Encoding");
		headers.set("Content-Type", "text/html; charset=utf-8");
		headers.set("Cache-Control", "public, max-age=3600, s-maxage=86400");
		headers.set("X-Content-Type-Options", "nosniff");
		headers.set("X-Frame-Options", "DENY");
		headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

		if (request.method === "HEAD") {
			return new Response(null, { headers });
		}

		return new Response(object.body, { headers });
	},
} satisfies ExportedHandler<Env>;
