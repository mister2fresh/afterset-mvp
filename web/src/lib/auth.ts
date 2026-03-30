import type { User } from "@supabase/supabase-js";
import { supabase } from "./supabase";

export type AuthUser = {
	id: string;
	email: string;
};

function toAuthUser(user: User): AuthUser {
	return { id: user.id, email: user.email ?? "" };
}

let currentUser: AuthUser | null = null;

export async function initAuth(onAuthChange?: () => void): Promise<void> {
	return new Promise<void>((resolve) => {
		const {
			data: { subscription },
		} = supabase.auth.onAuthStateChange((event, session) => {
			currentUser = session?.user ? toAuthUser(session.user) : null;
			if (event === "INITIAL_SESSION") {
				resolve();
			} else {
				onAuthChange?.();
			}
		});
		void subscription;
	});
}

export function getUser(): AuthUser | null {
	return currentUser;
}

export function clearUser(): void {
	currentUser = null;
}

export async function signInWithMagicLink(email: string): Promise<void> {
	const { error } = await supabase.auth.signInWithOtp({
		email,
		options: { emailRedirectTo: window.location.origin },
	});
	if (error) throw error;
}

export async function signOut(): Promise<void> {
	const { error } = await supabase.auth.signOut();
	if (error) throw error;
}
