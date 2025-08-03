// test-bedrock.js - Run this with Node to test your Bedrock connection
// Save this as a separate file and run with: node test-bedrock.js

import {
	BedrockRuntimeClient,
	InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

async function testBedrock() {
	console.log("=== Bedrock Connection Test ===");
	console.log("AWS Region:", process.env.AWS_REGION || "us-east-1");
	console.log(
		"AWS Access Key ID:",
		process.env.AWS_ACCESS_KEY_ID
			? "Set (starts with: " +
					process.env.AWS_ACCESS_KEY_ID.substring(0, 4) +
					"...)"
			: "NOT SET"
	);
	console.log(
		"AWS Secret Access Key:",
		process.env.AWS_SECRET_ACCESS_KEY
			? "Set (length: " + process.env.AWS_SECRET_ACCESS_KEY.length + ")"
			: "NOT SET"
	);

	// Default model if not specified
	const modelId =
		process.env.BEDROCK_MODEL_ID ||
		"us.anthropic.claude-3-5-haiku-20241022-v1:0";
	console.log("Using model:", modelId);

	try {
		// Initialize Bedrock client
		const bedrockClient = new BedrockRuntimeClient({
			region: process.env.AWS_REGION || "us-east-1",
			credentials: {
				accessKeyId: process.env.AWS_ACCESS_KEY_ID,
				secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
			},
		});

		// Create a minimal test request
		const input = {
			modelId,
			contentType: "application/json",
			accept: "application/json",
			body: JSON.stringify({
				anthropic_version: "bedrock-2023-05-31",
				max_tokens: 10,
				messages: [{ role: "user", content: "Say hello" }],
			}),
		};

		console.log("Sending request to Bedrock...");
		const command = new InvokeModelCommand(input);
		const startTime = Date.now();

		const response = await bedrockClient.send(command);
		const elapsedTime = Date.now() - startTime;

		console.log(`✅ Success! Response received in ${elapsedTime}ms`);
		console.log("HTTP Status:", response.$metadata.httpStatusCode);
		console.log("Request ID:", response.$metadata.requestId);

		const responseBody = JSON.parse(
			new TextDecoder().decode(response.body)
		);
		console.log("Response content:", responseBody.content[0].text);

		return true;
	} catch (error) {
		console.error("❌ Bedrock test failed:");
		console.error("Error type:", error.name);
		console.error("Error message:", error.message);

		if (error.$metadata) {
			console.error("HTTP Status:", error.$metadata.httpStatusCode);
			console.error("Request ID:", error.$metadata.requestId);
		}

		// Check for common errors
		if (error.name === "AccessDeniedException") {
			console.error(
				"\nACCESS DENIED: Your IAM user or role does not have permission to call Bedrock."
			);
			console.error(
				"Make sure your IAM policy includes bedrock:InvokeModel permission."
			);
		} else if (error.name === "ValidationException") {
			console.error(
				"\nVALIDATION ERROR: There is an issue with your request format or model ID."
			);
			console.error(
				"Check that your model ID is correct and available in your region."
			);
		} else if (error.name === "ThrottlingException") {
			console.error(
				"\nTHROTTLING: You are sending too many requests or exceeding token limits."
			);
			console.error(
				"Try implementing rate limiting in your application."
			);
		} else if (error.name === "ResourceNotFoundException") {
			console.error(
				"\nRESOURCE NOT FOUND: The specified model or resource does not exist."
			);
			console.error(
				"Check the model ID and ensure it is available in your region."
			);
		} else if (error.name === "ServiceQuotaExceededException") {
			console.error(
				"\nQUOTA EXCEEDED: You have exceeded your service quota."
			);
			console.error("Request a quota increase in the AWS Console.");
		}

		return false;
	}
}

// Run the test
testBedrock().then(() => {
	console.log("\nTest completed.");
});
