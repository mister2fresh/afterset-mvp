import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
	plugins: [
		TanStackRouterVite(),
		react(),
		tailwindcss(),
		VitePWA({
			registerType: "prompt",
			includeAssets: ["logo.svg", "apple-touch-icon-180.png"],
			manifest: {
				name: "Afterset",
				short_name: "Afterset",
				description: "Fan-capture dashboard for gigging musicians",
				theme_color: "#0a0e1a",
				background_color: "#0a0e1a",
				display: "standalone",
				start_url: "/",
				icons: [
					{ src: "pwa-192.png", sizes: "192x192", type: "image/png" },
					{ src: "pwa-512.png", sizes: "512x512", type: "image/png" },
					{ src: "pwa-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
				],
			},
			workbox: {
				globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
				runtimeCaching: [
					{
						urlPattern: /^https:\/\/.*\/api\//,
						handler: "StaleWhileRevalidate",
						options: {
							cacheName: "api-cache",
							expiration: { maxEntries: 50, maxAgeSeconds: 60 * 5 },
						},
					},
				],
			},
		}),
	],
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./src"),
		},
	},
	server: {
		proxy: {
			"/api": {
				target: "http://localhost:3000",
				changeOrigin: true,
			},
		},
	},
});
