import { BedrockRuntimeClient } from "@aws-sdk/client-bedrock-runtime";
import { fromEnv } from "@aws-sdk/credential-providers";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const region = process.env.AWS_REGION || "us-east-1";
export const modelId =
	process.env.BEDROCK_MODEL_ID || "anthropic.claude-3-sonnet-20240229-v1:0";

// Create and export the Bedrock client
export const getBedrockClient = (): BedrockRuntimeClient => {
	return new BedrockRuntimeClient({
		region,
		credentials: fromEnv(),
	});
};

// Validate AWS configuration
export const validateAwsConfig = (): boolean => {
	const requiredEnvVars = [
		"AWS_REGION",
		"AWS_ACCESS_KEY_ID",
		"AWS_SECRET_ACCESS_KEY",
		"BEDROCK_MODEL_ID",
	];

	const missingVars = requiredEnvVars.filter(
		(varName) => !process.env[varName]
	);

	if (missingVars.length > 0) {
		console.error("Missing required environment variables:", missingVars);
		return false;
	}

	return true;
};
