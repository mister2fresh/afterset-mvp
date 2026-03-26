import { PushNotifications } from "@capacitor/push-notifications";
import { useEffect, useRef } from "react";
import { api } from "@/lib/api";
import { getPlatform, isNativePlatform } from "@/lib/capacitor";

export function usePushNotifications() {
	const registered = useRef(false);

	useEffect(() => {
		if (!isNativePlatform() || registered.current) return;
		registered.current = true;

		async function setup() {
			const { receive } = await PushNotifications.checkPermissions();
			if (receive === "denied") return;

			if (receive === "prompt") {
				const result = await PushNotifications.requestPermissions();
				if (result.receive !== "granted") return;
			}

			await PushNotifications.register();

			PushNotifications.addListener("registration", async ({ value: token }) => {
				await api.post("/device-tokens", {
					token,
					platform: getPlatform(),
				});
			});

			PushNotifications.addListener("registrationError", (error) => {
				console.error("Push registration failed:", error);
			});
		}

		setup();

		return () => {
			PushNotifications.removeAllListeners();
		};
	}, []);
}
