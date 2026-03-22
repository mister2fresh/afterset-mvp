import { supabase } from "./supabase";

async function fetchApi<T>(path: string, options: RequestInit = {}): Promise<T> {
	const {
		data: { session },
	} = await supabase.auth.getSession();
	if (!session) throw new Error("Not authenticated");

	const res = await fetch(`/api${path}`, {
		...options,
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${session.access_token}`,
			...options.headers,
		},
	});

	if (!res.ok) {
		const body = await res.json().catch(() => ({}));
		throw new Error(body.error ?? `API error ${res.status}`);
	}

	if (res.status === 204) return undefined as T;
	return res.json();
}

export const api = {
	get: <T>(path: string) => fetchApi<T>(path),
	post: <T>(path: string, body: unknown) =>
		fetchApi<T>(path, { method: "POST", body: JSON.stringify(body) }),
	patch: <T>(path: string, body: unknown) =>
		fetchApi<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
	delete: (path: string) => fetchApi<void>(path, { method: "DELETE" }),
};
