import {
	BedrockRuntimeClient,
	InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";
import axios from "axios";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";

// Load environment variables
dotenv.config();

// Create Express server
const app = express();
const port = process.env.PORT || 4000;

// Middleware
app.use(cors());
app.use(express.json());

// GitHub API configuration
const githubApiBaseUrl = "https://api.github.com";
const githubToken = process.env.GITHUB_TOKEN || "";

// Create GitHub API client
const githubApi = axios.create({
	baseURL: githubApiBaseUrl,
	headers: githubToken ? { Authorization: `token ${githubToken}` } : {},
});

// Parse GitHub URL to extract owner and repo
function parseGitHubUrl(url) {
	try {
		const urlObj = new URL(url);
		if (!urlObj.hostname.includes("github.com")) {
			return null;
		}

		const pathParts = urlObj.pathname.split("/").filter(Boolean);
		if (pathParts.length < 2) {
			return null;
		}

		return {
			owner: pathParts[0],
			repo: pathParts[1],
		};
	} catch (error) {
		console.error("Error parsing GitHub URL:", error);
		return null;
	}
}

// Fetch repository info
async function getRepositoryInfo(owner, repo) {
	try {
		const response = await githubApi.get(`/repos/${owner}/${repo}`);
		return response.data;
	} catch (error) {
		console.error(
			`Error fetching repository info for ${owner}/${repo}:`,
			error
		);
		throw new Error("Failed to fetch repository information");
	}
}

// Recursively fetch repository file structure
async function getFileStructure(owner, repo, path = "", branch = "main") {
	try {
		const response = await githubApi.get(
			`/repos/${owner}/${repo}/contents/${path}`,
			{ params: { ref: branch } }
		);

		const fileStructure = [];

		for (const item of response.data) {
			const node = {
				path: item.path,
				type: item.type === "dir" ? "directory" : "file",
			};

			// If it's a directory, recursively fetch its contents
			if (item.type === "dir") {
				node.children = await getFileStructure(
					owner,
					repo,
					item.path,
					branch
				);
			}

			fileStructure.push(node);
		}

		return fileStructure;
	} catch (error) {
		console.error(`Error fetching file structure for ${path}:`, error);
		return [];
	}
}

// API endpoint to test Bedrock connection
app.post("/api/test-bedrock", async (req, res) => {
	try {
		console.log("Testing Bedrock connection...");

		const client = new BedrockRuntimeClient({
			region: process.env.AWS_REGION || "us-east-1",
			credentials: {
				accessKeyId: process.env.AWS_ACCESS_KEY_ID,
				secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
			},
		});

		const modelId =
			process.env.BEDROCK_MODEL_ID ||
			"us.anthropic.claude-3-5-haiku-20241022-v1:0";

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
		const responseBody = JSON.parse(
			new TextDecoder().decode(response.body)
		);

		console.log("Connection test successful");

		res.json({
			success: true,
			message: responseBody.content[0].text,
		});
	} catch (error) {
		console.error("Error testing Bedrock connection:", error.message);
		res.status(500).json({
			success: false,
			error: error.message,
		});
	}
});

// API endpoint to connect to a GitHub repository
app.post("/api/connect-repository", async (req, res) => {
	try {
		const { repoUrl } = req.body;

		// Parse the GitHub URL
		const repoInfo = parseGitHubUrl(repoUrl);
		if (!repoInfo) {
			return res.status(400).json({
				success: false,
				error: "Invalid GitHub repository URL",
			});
		}

		const { owner, repo } = repoInfo;

		// Get repository metadata
		const repoData = await getRepositoryInfo(owner, repo);
		console.log(`Connected to repository: ${owner}/${repo}`);

		// Get default branch from repository data
		const defaultBranch = repoData.default_branch;

		// Get repository file structure
		console.log(`Fetching file structure for ${owner}/${repo}...`);
		const fileStructure = await getFileStructure(
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

// Start the server
app.listen(port, () => {
	console.log(`Server running on port ${port}`);
	console.log(`Environment variables loaded:`);
	console.log(`- AWS_REGION: ${process.env.AWS_REGION || "not set"}`);
	console.log(
		`- BEDROCK_MODEL_ID: ${process.env.BEDROCK_MODEL_ID || "not set"}`
	);
	console.log(`- GITHUB_TOKEN: ${githubToken ? "set" : "not set"}`);
});
