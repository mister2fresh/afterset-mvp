import { supabase } from "./supabase";

async function getAccessToken(): Promise<string> {
	const {
		data: { session },
	} = await supabase.auth.getSession();
	if (!session) throw new Error("Not authenticated");

	// If token expires within 60s, force a refresh
	const expiresAt = session.expires_at ?? 0;
	if (expiresAt - Date.now() / 1000 < 60) {
		const { data } = await supabase.auth.refreshSession();
		if (!data.session) throw new Error("Not authenticated");
		return data.session.access_token;
	}

	return session.access_token;
}

async function fetchApi<T>(path: string, options: RequestInit = {}): Promise<T> {
	const token = await getAccessToken();

	const res = await fetch(`/api${path}`, {
		...options,
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${token}`,
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

export async function uploadToSignedUrl(
	signedUrl: string,
	token: string,
	file: File,
	onProgress?: (percent: number) => void,
): Promise<void> {
	return new Promise((resolve, reject) => {
		const xhr = new XMLHttpRequest();
		xhr.open("PUT", signedUrl);
		xhr.setRequestHeader("Authorization", `Bearer ${token}`);
		xhr.setRequestHeader("Content-Type", file.type);

		if (onProgress) {
			xhr.upload.addEventListener("progress", (e) => {
				if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
			});
		}

		xhr.addEventListener("load", () => {
			if (xhr.status >= 200 && xhr.status < 300) resolve();
			else reject(new Error(`Upload failed: ${xhr.status}`));
		});
		xhr.addEventListener("error", () => reject(new Error("Upload failed")));
		xhr.send(file);
	});
}

async function fetchApiText(path: string, options: RequestInit = {}): Promise<string> {
	const token = await getAccessToken();

	const res = await fetch(`/api${path}`, {
		...options,
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${token}`,
			...options.headers,
		},
	});

	if (!res.ok) {
		const body = await res.text().catch(() => "");
		throw new Error(body || `API error ${res.status}`);
	}

	return res.text();
}

async function fetchApiBlob(path: string): Promise<Blob> {
	const token = await getAccessToken();

	const res = await fetch(`/api${path}`, {
		headers: { Authorization: `Bearer ${token}` },
	});

	if (!res.ok) throw new Error(`API error ${res.status}`);
	return res.blob();
}

export const api = {
	get: <T>(path: string) => fetchApi<T>(path),
	post: <T>(path: string, body: unknown) =>
		fetchApi<T>(path, { method: "POST", body: JSON.stringify(body) }),
	put: <T>(path: string, body: unknown) =>
		fetchApi<T>(path, { method: "PUT", body: JSON.stringify(body) }),
	patch: <T>(path: string, body: unknown) =>
		fetchApi<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
	delete: (path: string) => fetchApi<void>(path, { method: "DELETE" }),
	postText: (path: string, body: unknown) =>
		fetchApiText(path, { method: "POST", body: JSON.stringify(body) }),
	getBlob: (path: string) => fetchApiBlob(path),
};
