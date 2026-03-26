import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
	appId: "net.afterset.app",
	appName: "Afterset",
	webDir: "dist",
	server: {
		hostname: "afterset.net",
		androidScheme: "https",
	},
	ios: {
		contentInset: "automatic",
		preferredContentMode: "mobile",
	},
	android: {
		backgroundColor: "#0a0e1a",
	},
	plugins: {
		SplashScreen: {
			launchShowDuration: 2000,
			launchAutoHide: true,
			backgroundColor: "#0a0e1a",
			showSpinner: false,
			splashFullScreen: true,
			splashImmersive: false,
		},
		PushNotifications: {
			presentationOptions: ["badge", "sound", "alert"],
		},
	},
};

export default config;
