import {
	BedrockRuntimeClient,
	InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";
import MockAiService from "./mockAiService.js";

class ChatService {
	constructor(config) {
		// Check if we should use mock mode
		this.useMockMode = config.useMockMode || 
						  !config.credentials?.accessKeyId || 
						  !config.credentials?.secretAccessKey;

		if (this.useMockMode) {
			console.log("🎭 ChatService using mock mode");
			this.mockAiService = new MockAiService();
		} else {
			console.log("🤖 ChatService using real Claude AI");
			this.bedrockClient = new BedrockRuntimeClient({
				region: config.region,
				credentials: config.credentials,
			});
		}
		this.modelId = config.modelId;
	}

	async callClaude(prompt, maxTokens = 1500) {
		// Use mock service if in mock mode
		if (this.useMockMode) {
			return await this.mockAiService.callClaude(prompt, maxTokens);
		}

		// Use real Claude AI
		const input = {
			modelId: this.modelId,
			contentType: "application/json",
			accept: "application/json",
			body: JSON.stringify({
				anthropic_version: "bedrock-2023-05-31",
				max_tokens: maxTokens,
				messages: [{ role: "user", content: prompt }],
			}),
		};

		const command = new InvokeModelCommand(input);
		const response = await this.bedrockClient.send(command);
		const responseBody = JSON.parse(new TextDecoder().decode(response.body));

		return responseBody.content[0].text;
	}

	findRelevantFiles(message, documentedFiles) {
		if (!documentedFiles) {
			console.log("Warning: documentedFiles is undefined or null");
			return [];
		}

		const messageLower = message.toLowerCase();
		const keywords = this.extractKeywords(messageLower);

		const fileScores = Object.entries(documentedFiles).map(([filePath, fileDoc]) => {
			let score = 0;

			if (messageLower.includes(filePath.toLowerCase())) {
				score += 10;
			}

			const fileName = filePath.split("/").pop();
			if (messageLower.includes(fileName.toLowerCase())) {
				score += 8;
			}

			try {
				const docContent = [
					fileDoc.overview || "",
					fileDoc.purpose || "",
					...(fileDoc.dependencies || []),
					...(fileDoc.components || []).map(
						(comp) =>
							`${comp.name} ${comp.description} ${(comp.params || [])
								.map((p) => p.name)
								.join(" ")}`
					),
					fileDoc.notes || "",
				]
					.join(" ")
					.toLowerCase();

				keywords.forEach((keyword) => {
					if (docContent.includes(keyword)) {
						score += 2;
					}
				});
			} catch (err) {
				console.log(`Error processing file ${filePath}:`, err.message);
			}

			if (this.isDebuggingQuestion(messageLower) && filePath.includes(".js")) {
				score += 3;
			}

			return { filePath, fileDoc, score };
		});

		return fileScores
			.sort((a, b) => b.score - a.score)
			.slice(0, 3)
			.filter((item) => item.score > 0)
			.map((item) => ({ path: item.filePath, doc: item.fileDoc }));
	}

	extractKeywords(message) {
		const stopWords = [
			"the", "is", "at", "which", "on", "how", "what", "why", "where", 
			"when", "can", "could", "would", "should",
		];
		return message
			.split(/\s+/)
			.filter((word) => word.length > 2 && !stopWords.includes(word))
			.filter((word) => /^[a-zA-Z0-9_.-]+$/.test(word));
	}

	isDebuggingQuestion(message) {
		const debugPatterns = [
			"debug", "error", "bug", "issue", "problem", "fix", 
			"broken", "not working", "failing", "exception", "crash",
		];
		return debugPatterns.some((pattern) => message.includes(pattern));
	}

	createChatPrompt(userMessage, repoContext, relevantFiles, conversationContext) {
		let prompt = `You are a helpful AI assistant specialized in explaining and helping with code repositories. You have access to comprehensive documentation about the repository.

Repository: ${repoContext.name}
${repoContext.description ? `Description: ${repoContext.description}` : ""}

Repository Summary:
${repoContext.summary ? repoContext.summary.summary : "No summary available"}

Technologies used: ${
			repoContext.summary?.technologies
				? repoContext.summary.technologies.join(", ")
				: "Not specified"
		}
Main components: ${
			repoContext.summary?.mainComponents
				? repoContext.summary.mainComponents.join(", ")
				: "Not specified"
		}

Available files in the repository: ${repoContext.files.join(", ")}`;

		if (relevantFiles && relevantFiles.length > 0) {
			prompt += "\n\nRelevant file documentation:\n";
			relevantFiles.forEach((file) => {
				prompt += `\n--- ${file.path} ---\n`;
				prompt += `Overview: ${file.doc.overview || "No overview"}\n`;
				if (file.doc.purpose) prompt += `Purpose: ${file.doc.purpose}\n`;
				if (file.doc.dependencies && file.doc.dependencies.length > 0) {
					prompt += `Dependencies: ${file.doc.dependencies.join(", ")}\n`;
				}
				if (file.doc.components && file.doc.components.length > 0) {
					prompt += "Components:\n";
					file.doc.components.slice(0, 3).forEach((comp) => {
						prompt += `- ${comp.name} (${comp.type}): ${comp.description}\n`;
					});
				}
			});
		}

		prompt += conversationContext;

		prompt += `\n\nUser question: ${userMessage}

IMPORTANT: Keep your response under 4 sentences. Use straightforward language. Be direct and specific. Avoid lengthy explanations.

Response:`;

		return prompt;
	}
}

export default ChatService;