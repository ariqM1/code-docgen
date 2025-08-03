import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import {
	generateRepositoryDocumentation,
	convertToMarkdown,
	initDocumentationGenerator,
} from "./documentationGenerator.js";
import GitHubService from "./services/githubService.js";
import ChatService from "./services/chatService.js";

// Load environment variables
dotenv.config();

// Initialize documentation generator
initDocumentationGenerator();

// Configuration
const CONFIG = {
	port: process.env.PORT || 4000,
	github: {
		token: process.env.GITHUB_TOKEN || "",
	},
	bedrock: {
		region: process.env.AWS_REGION || "us-east-1",
		modelId: process.env.BEDROCK_MODEL_ID || "us.anthropic.claude-3-5-haiku-20241022-v1:0",
		credentials: {
			accessKeyId: process.env.AWS_ACCESS_KEY_ID,
			secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
		},
	},
};

// Initialize services
const githubService = new GitHubService(CONFIG.github.token);

// Add mock mode flag to chat service config
const chatConfig = {
	...CONFIG.bedrock,
	useMockMode: !CONFIG.bedrock.credentials.accessKeyId || !CONFIG.bedrock.credentials.secretAccessKey
};
const chatService = new ChatService(chatConfig);

// Cache for repository documentation
const documentationCache = {};

// Create Express server
const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: "50mb" }));

// Health check endpoint
app.get("/api/health", (_, res) => {
	res.json({
		status: "ok",
		message: "Documentation generator server is running",
		version: "1.0.0",
	});
});

// Test Bedrock connection
app.post("/api/test-bedrock", async (_, res) => {
	try {
		console.log("Testing Bedrock connection...");
		const response = await chatService.callClaude("Say hello", 100);
		
		res.json({
			success: true,
			message: response,
		});
	} catch (error) {
		console.error("Error testing Bedrock connection:", error.message);
		res.status(500).json({
			success: false,
			error: error.message,
		});
	}
});

// Connect to GitHub repository
app.post("/api/connect-repository", async (req, res) => {
	try {
		const { repoUrl } = req.body;
		console.log("Connecting to repository:", repoUrl);

		const repoInfo = githubService.parseGitHubUrl(repoUrl);
		if (!repoInfo) {
			return res.status(400).json({
				success: false,
				error: "Invalid GitHub repository URL",
			});
		}

		const { owner, repo } = repoInfo;
		const repoData = await githubService.getRepositoryInfo(owner, repo);
		console.log(`Connected to repository: ${owner}/${repo}`);

		const defaultBranch = repoData.default_branch;
		const fileStructure = await githubService.getFileStructure(
			owner,
			repo,
			"",
			defaultBranch
		);

		res.json({
			success: true,
			repository: {
				owner,
				name: repoData.name,
				url: repoData.html_url,
				description: repoData.description,
				defaultBranch,
				fileStructure,
			},
		});
	} catch (error) {
		console.error("Error connecting to repository:", error.message);
		res.status(500).json({
			success: false,
			error: error.message || "Failed to connect to repository",
		});
	}
});

// Generate documentation
app.post("/api/generate-documentation", async (req, res) => {
	try {
		const { owner, repo, branch, fileStructure } = req.body;

		if (!owner || !repo || !fileStructure) {
			return res.status(400).json({
				success: false,
				error: "Missing required parameters",
			});
		}

		console.log(`Generating documentation for ${owner}/${repo}...`);

		// Check cache first
		const cacheKey = `${owner}/${repo}`;
		if (documentationCache[cacheKey]) {
			console.log(`Using cached documentation for ${owner}/${repo}`);
			return res.json({
				success: true,
				documentation: documentationCache[cacheKey],
			});
		}

		// Prepare repository object
		const repository = {
			owner,
			name: repo,
			defaultBranch: branch,
			description: `Repository for ${owner}/${repo}`,
		};

		// Generate documentation
		const documentation = await generateRepositoryDocumentation(
			repository,
			fileStructure
		);

		// Convert to markdown
		const markdown = convertToMarkdown(documentation);

		// Cache the result
		const result = { json: documentation, markdown };
		documentationCache[cacheKey] = result;

		res.json({
			success: true,
			documentation: result,
		});
	} catch (error) {
		console.error("Error generating documentation:", error);
		res.status(500).json({
			success: false,
			error: error.message || "Failed to generate documentation",
		});
	}
});

// Chat about repository
app.post("/api/chat-about-repository", async (req, res) => {
	try {
		const { message, repository, documentation, conversationHistory } = req.body;

		if (!message || !repository || !documentation) {
			const missingParams = [];
			if (!message) missingParams.push("message");
			if (!repository) missingParams.push("repository");
			if (!documentation) missingParams.push("documentation");

			return res.status(400).json({
				success: false,
				error: `Missing required parameters: ${missingParams.join(", ")}`,
			});
		}

		console.log(`Processing chat request for ${repository.owner}/${repository.name}`);

		// Prepare repository context
		const repoContext = {
			name: `${repository.owner}/${repository.name}`,
			description: documentation.repository.description,
			summary: documentation.summary,
			files: Object.keys(documentation.files),
		};

		// Build conversation context
		let conversationContext = "";
		if (conversationHistory && conversationHistory.length > 0) {
			conversationContext = "\n\nRecent conversation:\n";
			conversationHistory.slice(-6).forEach((msg) => {
				conversationContext += `${
					msg.role === "user" ? "User" : "Assistant"
				}: ${msg.content}\n`;
			});
		}

		// Find relevant files and create prompt
		const relevantFiles = chatService.findRelevantFiles(message, documentation.files);
		const prompt = chatService.createChatPrompt(
			message,
			repoContext,
			relevantFiles,
			conversationContext
		);

		// Get response from Claude
		const reply = await chatService.callClaude(prompt, 1500);

		res.json({
			success: true,
			reply: reply.trim(),
		});
	} catch (error) {
		console.error("Error in chat endpoint:", error);
		res.status(500).json({
			success: false,
			error: `Chat processing failed: ${error.message}`,
		});
	}
});

// Start the server
app.listen(CONFIG.port, () => {
	console.log(`Server running on port ${CONFIG.port}`);
	console.log(`Environment variables loaded:`);
	console.log(`- AWS_REGION: ${CONFIG.bedrock.region}`);
	console.log(`- BEDROCK_MODEL_ID: ${CONFIG.bedrock.modelId}`);
	console.log(`- GITHUB_TOKEN: ${CONFIG.github.token ? "set" : "not set"}`);
});