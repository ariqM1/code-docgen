// test-bedrock.js
const {
	BedrockRuntimeClient,
	InvokeModelCommand,
} = require("@aws-sdk/client-bedrock-runtime");
require("dotenv").config();

// Log loaded environment variables
console.log("Environment variables:");
console.log(`- AWS_REGION: ${process.env.AWS_REGION || "not set"}`);
console.log(`- BEDROCK_MODEL_ID: ${process.env.BEDROCK_MODEL_ID || "not set"}`);

async function testBedrockDirectly() {
	try {
		const client = new BedrockRuntimeClient({
			region: process.env.AWS_REGION || "us-east-1",
			credentials: {
				accessKeyId: process.env.AWS_ACCESS_KEY_ID,
				secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
			},
		});

		// Try with hardcoded model ID first
		const modelId =
			process.env.BEDROCK_MODEL_ID ||
			"us.anthropic.claude-3-5-haiku-20241022-v1:0";
		console.log(`Testing connection with model ID: ${modelId}`);

		const input = {
			modelId: modelId,
			contentType: "application/json",
			accept: "application/json",
			body: JSON.stringify({
				anthropic_version: "bedrock-2023-05-31",
				max_tokens: 100,
				messages: [{ role: "user", content: "Say hello" }],
			}),
		};

		const command = new InvokeModelCommand(input);
		const response = await client.send(command);

		console.log("Success! Connection test passed.");
		const responseBody = JSON.parse(
			new TextDecoder().decode(response.body)
		);
		console.log("Response:", responseBody);
		return true;
	} catch (error) {
		console.error("Error testing Bedrock connection:");
		console.error(error);
		return false;
	}
}

testBedrockDirectly();
