import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		env: {
			UNSUBSCRIBE_HMAC_SECRET: "test-secret-do-not-use-in-production",
		},
	},
});
