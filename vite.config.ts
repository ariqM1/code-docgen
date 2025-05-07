import react from "@vitejs/plugin-react";
import dotenv from "dotenv";
import { defineConfig } from "vite";

// Load env variables
dotenv.config();

// https://vitejs.dev/config/
export default defineConfig({
	plugins: [react()],
	server: {
		port: 3000,
	},
	define: {
		// Make env variables available to client-side code
		"process.env.AWS_REGION": JSON.stringify(process.env.AWS_REGION),
		"process.env.BEDROCK_MODEL_ID": JSON.stringify(
			process.env.BEDROCK_MODEL_ID
		),
	},
});
