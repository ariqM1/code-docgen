import {
	BedrockRuntimeClient,
	InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";
import axios from "axios";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";

// Load environment variables
dotenv.config();

// Create Express server
const app = express();
const port = process.env.PORT || 4000;

// Middleware
app.use(cors());
app.use(express.json({ limit: "50mb" })); // Increased limit for large repositories

// GitHub API configuration
const githubApiBaseUrl = "https://api.github.com";
const githubToken = process.env.GITHUB_TOKEN || "";

// Create GitHub API client
const githubApi = axios.create({
	baseURL: githubApiBaseUrl,
	headers: githubToken ? { Authorization: `token ${githubToken}` } : {},
});

// Bedrock client setup
const bedrockClient = new BedrockRuntimeClient({
	region: process.env.AWS_REGION || "us-east-1",
	credentials: {
		accessKeyId: process.env.AWS_ACCESS_KEY_ID,
		secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
	},
});

const modelId =
	process.env.BEDROCK_MODEL_ID ||
	"us.anthropic.claude-3-5-haiku-20241022-v1:0";

// Cache for repository documentation
const documentationCache = {};

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

// Fetch file content from GitHub
async function fetchFileContent(owner, repo, filePath, branch) {
	try {
		const response = await githubApi.get(
			`/repos/${owner}/${repo}/contents/${filePath}`,
			{ params: { ref: branch } }
		);

		// GitHub API returns base64 encoded content
		const content = Buffer.from(response.data.content, "base64").toString();
		return content;
	} catch (error) {
		console.error(`Error fetching file content for ${filePath}:`, error);
		return null;
	}
}

// Determine file language based on extension
function getFileLanguage(filePath) {
	const extension = path.extname(filePath).toLowerCase();

	const LANGUAGE_CONFIG = {
		js: {
			extensions: [".js", ".jsx"],
			fileType: "JavaScript",
		},
		ts: {
			extensions: [".ts", ".tsx"],
			fileType: "TypeScript",
		},
		py: {
			extensions: [".py"],
			fileType: "Python",
		},
		java: {
			extensions: [".java"],
			fileType: "Java",
		},
		// Add more languages as needed
	};

	for (const [lang, config] of Object.entries(LANGUAGE_CONFIG)) {
		if (config.extensions.includes(extension)) {
			return { language: lang, fileType: config.fileType };
		}
	}

	return { language: null, fileType: "Unknown" };
}

// Check if file should be documented
function shouldDocumentFile(filePath) {
	// File patterns to exclude
	const EXCLUDED_PATTERNS = [
		/node_modules/,
		/\.git/,
		/dist/,
		/build/,
		/__pycache__/,
		/\.DS_Store/,
		/\.env/,
	];

	// Check exclusion patterns
	if (EXCLUDED_PATTERNS.some((pattern) => pattern.test(filePath))) {
		return false;
	}

	// Check supported languages
	const { language } = getFileLanguage(filePath);
	return language !== null;
}

// Generate documentation for a single file using Claude
async function generateFileDocumentation(fileContent, filePath, repo) {
	try {
		const { fileType } = getFileLanguage(filePath);

		// Create the prompt for Claude
		const prompt = `You are a technical documentation expert. Please analyze this code file and provide comprehensive documentation for it.
	  
  File path: ${filePath}
  File type: ${fileType}
  Repository: ${repo.owner}/${repo.name}
  
  Code:
  \`\`\`
  ${fileContent}
  \`\`\`
  
  Please provide documentation in the following JSON structure:
  {
	"overview": "Brief overview of what this file does",
	"purpose": "The main purpose/responsibility of this file in the repository",
	"dependencies": ["List of key dependencies and imports"],
	"components": [
	  {
		"name": "ComponentName",
		"type": "function/class/component",
		"description": "Detailed description",
		"params": [
		  {
			"name": "paramName",
			"type": "dataType",
			"description": "Parameter description"
		  }
		],
		"returns": {
		  "type": "returnType",
		  "description": "Description of return value"
		},
		"examples": [
		  "Usage example"
		]
	  }
	],
	"notes": "Additional notes, edge cases, or limitations"
  }`;

		// Call Claude using Bedrock
		console.log(`Sending prompt to Claude for ${filePath}...`);
		const input = {
			modelId,
			contentType: "application/json",
			accept: "application/json",
			body: JSON.stringify({
				anthropic_version: "bedrock-2023-05-31",
				max_tokens: 4000,
				messages: [{ role: "user", content: prompt }],
			}),
		};

		const command = new InvokeModelCommand(input);
		const response = await bedrockClient.send(command);
		const responseBody = JSON.parse(
			new TextDecoder().decode(response.body)
		);

		// Extract and parse the JSON response
		const content = responseBody.content[0].text;
		let jsonMatch =
			content.match(/```json\n([\s\S]*?)\n```/) ||
			content.match(/{[\s\S]*}/);

		let docObject;

		if (jsonMatch) {
			try {
				const jsonStr = jsonMatch[1] || jsonMatch[0];
				docObject = JSON.parse(jsonStr);
			} catch (e) {
				console.error("Error parsing JSON from Claude response:", e);
				docObject = { error: "Could not parse documentation as JSON" };
			}
		} else {
			// Fallback if JSON parsing fails
			docObject = {
				overview: content,
				error: "Documentation not in expected JSON format",
			};
		}

		// Add metadata
		docObject.metadata = {
			filePath,
			fileType,
			generatedAt: new Date().toISOString(),
			repositoryInfo: {
				owner: repo.owner,
				name: repo.name,
				branch: repo.defaultBranch,
			},
		};

		return docObject;
	} catch (error) {
		console.error("Error generating documentation:", error);
		return {
			error: `Error generating documentation for ${filePath}: ${error.message}`,
			filePath,
			generatedAt: new Date().toISOString(),
		};
	}
}

// Generate a summary of the repository based on individual file documentation
async function generateRepositorySummary(documentation, repo) {
	try {
		// Create a summary of the files we've analyzed
		const fileOverviews = Object.entries(documentation.files).map(
			([path, doc]) => `- ${path}: ${doc.overview || "No overview"}`
		);

		const prompt = `You are a technical documentation expert. Please create a high-level summary of this repository based on the documentation of its files.
	  
  Repository: ${repo.owner}/${repo.name}
  Description: ${repo.description || "No description provided"}
  
  File overviews:
  ${fileOverviews.join("\n")}
  
  Please provide:
  1. A concise summary of what this repository does
  2. The main components and their responsibilities
  3. The architecture pattern used (if identifiable)
  4. Key technologies and dependencies
  5. Possible use cases for this codebase
  
  Format your response as JSON with the following structure:
  {
	"summary": "Repository summary",
	"mainComponents": ["List of main components and their responsibilities"],
	"architecture": "Identified architecture pattern",
	"technologies": ["List of key technologies"],
	"useCases": ["Potential use cases"]
  }`;

		// Call Claude using Bedrock
		console.log(
			`Generating repository summary for ${repo.owner}/${repo.name}...`
		);
		const input = {
			modelId,
			contentType: "application/json",
			accept: "application/json",
			body: JSON.stringify({
				anthropic_version: "bedrock-2023-05-31",
				max_tokens: 2000,
				messages: [{ role: "user", content: prompt }],
			}),
		};

		const command = new InvokeModelCommand(input);
		const response = await bedrockClient.send(command);
		const responseBody = JSON.parse(
			new TextDecoder().decode(response.body)
		);

		// Extract and parse the JSON response
		const content = responseBody.content[0].text;
		let jsonMatch =
			content.match(/```json\n([\s\S]*?)\n```/) ||
			content.match(/{[\s\S]*}/);

		if (jsonMatch) {
			try {
				const jsonStr = jsonMatch[1] || jsonMatch[0];
				return JSON.parse(jsonStr);
			} catch (e) {
				console.error("Error parsing JSON from Claude response:", e);
				return {
					summary:
						"Could not generate repository summary in the expected format.",
					error: e.message,
				};
			}
		} else {
			return {
				summary: content,
				note: "Summary not in expected JSON format",
			};
		}
	} catch (error) {
		console.error("Error generating repository summary:", error);
		return {
			summary: "Error generating repository summary",
			error: error.message,
		};
	}
}

// Generate documentation for repository files
async function generateRepositoryDocumentation(repo, fileStructure) {
	try {
		// Initialize the documentation object
		const documentation = {
			repository: {
				owner: repo.owner,
				name: repo.name,
				description: repo.description,
				defaultBranch: repo.defaultBranch,
			},
			generated: new Date().toISOString(),
			files: {},
			summary: null,
		};

		// Track files to process
		const filesToProcess = [];

		// Function to recursively find files
		const findFiles = (files) => {
			for (const file of files) {
				const filePath = file.path;

				if (file.type === "file" && shouldDocumentFile(filePath)) {
					filesToProcess.push(filePath);
				} else if (
					file.type === "directory" &&
					Array.isArray(file.children)
				) {
					findFiles(file.children);
				}
			}
		};

		// Find all files to document
		findFiles(fileStructure);

		console.log(`Found ${filesToProcess.length} files to document`);

		// Limit the number of files for demo purposes
		const maxFiles = 5; // Adjust as needed
		if (filesToProcess.length > maxFiles) {
			console.log(`Limiting to ${maxFiles} files for performance`);
			filesToProcess.length = maxFiles;
		}

		// Process files in batches to avoid rate limiting
		const batchSize = 2;
		for (let i = 0; i < filesToProcess.length; i += batchSize) {
			const batch = filesToProcess.slice(i, i + batchSize);

			console.log(
				`Processing batch ${i / batchSize + 1} of ${Math.ceil(
					filesToProcess.length / batchSize
				)}`
			);

			// Process files in this batch in parallel
			const batchPromises = batch.map(async (filePath) => {
				console.log(`Generating documentation for ${filePath}...`);

				// Fetch file content
				const fileContent = await fetchFileContent(
					repo.owner,
					repo.name,
					filePath,
					repo.defaultBranch
				);

				if (fileContent) {
					// Generate documentation
					const fileDoc = await generateFileDocumentation(
						fileContent,
						filePath,
						repo
					);
					documentation.files[filePath] = fileDoc;
				}
			});

			// Wait for batch to complete
			await Promise.all(batchPromises);
		}

		// Generate repository summary
		documentation.summary = await generateRepositorySummary(
			documentation,
			repo
		);

		return documentation;
	} catch (error) {
		console.error("Error generating repository documentation:", error);
		throw error;
	}
}

function convertToMarkdown(documentation) {
	let markdown = `# ${documentation.repository.owner}/${documentation.repository.name}\n\n`;

	// Add repository summary
	if (documentation.summary) {
		markdown += `## Repository Summary\n\n`;
		markdown += `${
			documentation.summary.summary || "No summary available"
		}\n\n`;

		if (documentation.summary.mainComponents) {
			markdown += `### Main Components\n\n`;
			documentation.summary.mainComponents.forEach((comp) => {
				markdown += `- ${comp}\n`;
			});
			markdown += "\n";
		}

		if (documentation.summary.architecture) {
			markdown += `### Architecture\n\n`;
			markdown += `${documentation.summary.architecture}\n\n`;
		}

		if (documentation.summary.technologies) {
			markdown += `### Technologies\n\n`;
			documentation.summary.technologies.forEach((tech) => {
				markdown += `- ${tech}\n`;
			});
			markdown += "\n";
		}

		if (documentation.summary.useCases) {
			markdown += `### Use Cases\n\n`;
			documentation.summary.useCases.forEach((useCase) => {
				markdown += `- ${useCase}\n`;
			});
			markdown += "\n";
		}
	}

	// Add table of contents
	markdown += `## Files\n\n`;
	Object.keys(documentation.files)
		.sort()
		.forEach((filePath) => {
			const file = documentation.files[filePath];
			if (!file.error) {
				const anchor = encodeURIComponent(filePath);
				markdown += `- [${filePath}](#${anchor})\n`;
			}
		});
	markdown += "\n";

	// Add documentation for each file
	Object.keys(documentation.files)
		.sort()
		.forEach((filePath) => {
			const file = documentation.files[filePath];
			const anchor = encodeURIComponent(filePath);

			markdown += `<a id="${anchor}"></a>\n`;
			markdown += `## ${filePath}\n\n`;

			if (file.error) {
				markdown += `> Error: ${file.error}\n\n`;
				return;
			}

			markdown += `### Overview\n\n${file.overview}\n\n`;

			if (file.purpose) {
				markdown += `### Purpose\n\n${file.purpose}\n\n`;
			}

			if (file.dependencies && file.dependencies.length > 0) {
				markdown += `### Dependencies\n\n`;
				file.dependencies.forEach((dep) => {
					markdown += `- ${dep}\n`;
				});
				markdown += "\n";
			}

			if (file.components && file.components.length > 0) {
				markdown += `### Components\n\n`;

				file.components.forEach((component) => {
					markdown += `#### ${component.name} (${component.type})\n\n`;
					markdown += `${component.description}\n\n`;

					if (component.params && component.params.length > 0) {
						markdown += `**Parameters:**\n\n`;
						component.params.forEach((param) => {
							markdown += `- \`${param.name}\` (${param.type}): ${param.description}\n`;
						});
						markdown += "\n";
					}

					if (component.returns) {
						markdown += `**Returns:**\n\n`;
						markdown += `- (${component.returns.type}): ${component.returns.description}\n\n`;
					}

					if (component.examples && component.examples.length > 0) {
						markdown += `**Examples:**\n\n`;
						component.examples.forEach((example) => {
							markdown += `\`\`\`\n${example}\n\`\`\`\n\n`;
						});
					}
				});
			}

			if (file.notes) {
				markdown += `### Notes\n\n${file.notes}\n\n`;
			}

			// Add separator between files
			markdown += `---\n\n`;
		});

	// Add generation metadata
	markdown += `\n\n---\n\n`;
	markdown += `Generated on: ${new Date(
		documentation.generated
	).toLocaleString()}\n`;

	return markdown;
}

// Helper function to find relevant files based on the user's message
function findRelevantFiles(message, documentedFiles) {
	if (!documentedFiles) {
		console.log("Warning: documentedFiles is undefined or null");
		return [];
	}

	const messageLower = message.toLowerCase();

	// Extract keywords from the message
	const keywords = extractKeywords(messageLower);
	console.log("Extracted keywords:", keywords);

	// Score each file based on relevance
	const fileScores = Object.entries(documentedFiles).map(
		([filePath, fileDoc]) => {
			let score = 0;

			// Check if file path is mentioned directly
			if (messageLower.includes(filePath.toLowerCase())) {
				score += 10;
			}

			// Check file name
			const fileName = filePath.split("/").pop();
			if (messageLower.includes(fileName.toLowerCase())) {
				score += 8;
			}

			// Check documentation content
			try {
				const docContent = [
					fileDoc.overview || "",
					fileDoc.purpose || "",
					...(fileDoc.dependencies || []),
					...(fileDoc.components || []).map(
						(comp) =>
							`${comp.name} ${comp.description} ${(
								comp.params || []
							)
								.map((p) => p.name)
								.join(" ")}`
					),
					fileDoc.notes || "",
				]
					.join(" ")
					.toLowerCase();

				// Score based on keyword matches
				keywords.forEach((keyword) => {
					if (docContent.includes(keyword)) {
						score += 2;
					}
				});
			} catch (err) {
				console.log(`Error processing file ${filePath}:`, err.message);
			}

			// Boost score for certain file types based on question type
			if (isDebuggingQuestion(messageLower) && filePath.includes(".js")) {
				score += 3;
			}

			return { filePath, fileDoc, score };
		}
	);

	// Sort by score and take top 3 most relevant files
	const relevantFiles = fileScores
		.sort((a, b) => b.score - a.score)
		.slice(0, 3)
		.filter((item) => item.score > 0)
		.map((item) => ({ path: item.filePath, doc: item.fileDoc }));

	return relevantFiles;
}

// Helper function to extract keywords from message
function extractKeywords(message) {
	// Remove common stop words and extract meaningful terms
	const stopWords = [
		"the",
		"is",
		"at",
		"which",
		"on",
		"how",
		"what",
		"why",
		"where",
		"when",
		"can",
		"could",
		"would",
		"should",
	];
	return message
		.split(/\s+/)
		.filter((word) => word.length > 2 && !stopWords.includes(word))
		.filter((word) => /^[a-zA-Z0-9_.-]+$/.test(word));
}

// Helper function to detect debugging questions
function isDebuggingQuestion(message) {
	const debugPatterns = [
		"debug",
		"error",
		"bug",
		"issue",
		"problem",
		"fix",
		"broken",
		"not working",
		"failing",
		"exception",
		"crash",
	];
	return debugPatterns.some((pattern) => message.includes(pattern));
}

// Helper function to create the chat prompt
function createChatPrompt(
	userMessage,
	repoContext,
	relevantFiles,
	conversationContext
) {
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

	// Add relevant file documentation if found
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

	// Add conversation context
	prompt += conversationContext;

	prompt += `\n\nUser question: ${userMessage}

Please provide a helpful, accurate response based on the repository documentation. If the question is about debugging or solving issues, provide specific guidance. If asked about specific files or functions, reference the relevant documentation. Keep your response concise but informative.

Response:`;

	return prompt;
}

// API endpoint to test Bedrock connection
app.post("/api/test-bedrock", async (req, res) => {
	try {
		console.log("Testing Bedrock connection...");

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
		const response = await bedrockClient.send(command);
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

app.post("/api/chat-about-repository", async (req, res) => {
	console.log("=== Chat Request Received ===");
	console.log("Headers:", req.headers);
	console.log("Body keys:", Object.keys(req.body));
	console.log(
		"Body types:",
		Object.keys(req.body).map((key) => `${key}: ${typeof req.body[key]}`)
	);

	try {
		const { message, repository, documentation, conversationHistory } =
			req.body;

		// Detailed validation with logging
		console.log("=== Parameter Validation ===");
		console.log("Message:", message ? "✓ Present" : "✗ Missing");
		console.log("Repository:", repository ? "✓ Present" : "✗ Missing");
		console.log(
			"Documentation:",
			documentation ? "✓ Present" : "✗ Missing"
		);

		if (repository) {
			console.log("Repository details:", {
				owner: repository.owner,
				name: repository.name,
			});
		}

		if (documentation && documentation.files) {
			console.log(
				"Documentation files count:",
				Object.keys(documentation.files).length
			);
		}

		if (!message || !repository || !documentation) {
			const missingParams = [];
			if (!message) missingParams.push("message");
			if (!repository) missingParams.push("repository");
			if (!documentation) missingParams.push("documentation");

			console.error("Missing parameters:", missingParams);
			return res.status(400).json({
				success: false,
				error: `Missing required parameters: ${missingParams.join(
					", "
				)}`,
			});
		}

		console.log(
			`Processing chat request for ${repository.owner}/${repository.name}`
		);
		console.log(`User message: "${message}"`);

		// Check if bedrockClient is initialized
		if (!bedrockClient) {
			console.error("❌ Bedrock client not initialized");
			return res.status(500).json({
				success: false,
				error: "Bedrock client not initialized",
			});
		}

		console.log("✓ Bedrock client is initialized");
		console.log("✓ Model ID:", modelId);

		// Prepare context about the repository
		const repoContext = {
			name: `${repository.owner}/${repository.name}`,
			description: documentation.repository.description,
			summary: documentation.summary,
			files: Object.keys(documentation.files),
			generatedOn: documentation.generated,
		};

		console.log("=== Repository Context ===");
		console.log("Files available:", repoContext.files.length);

		// Build conversation context from history
		let conversationContext = "";
		if (conversationHistory && conversationHistory.length > 0) {
			conversationContext = "\n\nRecent conversation:\n";
			conversationHistory.slice(-6).forEach((msg) => {
				conversationContext += `${
					msg.role === "user" ? "User" : "Assistant"
				}: ${msg.content}\n`;
			});
			console.log(
				"✓ Conversation history included, messages:",
				conversationHistory.length
			);
		}

		// Determine which files are relevant to the query
		const relevantFiles = findRelevantFiles(message, documentation.files);
		console.log("✓ Relevant files found:", relevantFiles.length);
		relevantFiles.forEach((file) => console.log(`  - ${file.path}`));

		// Create the chat prompt
		const prompt = createChatPrompt(
			message,
			repoContext,
			relevantFiles,
			conversationContext
		);
		console.log("✓ Prompt created, length:", prompt.length);

		// Call Claude using Bedrock
		console.log("=== Calling Claude via Bedrock ===");
		const input = {
			modelId: modelId,
			contentType: "application/json",
			accept: "application/json",
			body: JSON.stringify({
				anthropic_version: "bedrock-2023-05-31",
				max_tokens: 1500,
				messages: [{ role: "user", content: prompt }],
			}),
		};

		console.log("Bedrock input prepared, calling API...");
		const command = new InvokeModelCommand(input);
		const response = await bedrockClient.send(command);

		console.log("✓ Bedrock API call successful");
		console.log("Response status:", response.$metadata?.httpStatusCode);

		const responseBody = JSON.parse(
			new TextDecoder().decode(response.body)
		);

		console.log("✓ Response body parsed");
		console.log("Response content type:", typeof responseBody.content);
		console.log(
			"Response content length:",
			responseBody.content ? responseBody.content.length : 0
		);

		if (
			!responseBody.content ||
			!responseBody.content[0] ||
			!responseBody.content[0].text
		) {
			console.error("❌ Invalid response structure from Claude");
			console.error(
				"Response body:",
				JSON.stringify(responseBody, null, 2)
			);
			return res.status(500).json({
				success: false,
				error: "Invalid response from AI service",
			});
		}

		const reply = responseBody.content[0].text;
		console.log("✓ Reply extracted, length:", reply.length);
		console.log("Reply preview:", reply.substring(0, 100) + "...");

		res.json({
			success: true,
			reply: reply.trim(),
		});

		console.log("=== Chat Request Completed Successfully ===");
	} catch (error) {
		console.error("=== ERROR in Chat Endpoint ===");
		console.error("Error type:", error.constructor.name);
		console.error("Error message:", error.message);
		console.error("Error stack:", error.stack);

		// Check for specific AWS/Bedrock errors
		if (error.name === "ValidationException") {
			console.error(
				"❌ Bedrock Validation Error - Check your model ID and parameters"
			);
		} else if (error.name === "AccessDeniedException") {
			console.error(
				"❌ Bedrock Access Denied - Check your AWS credentials and permissions"
			);
		} else if (error.name === "ThrottlingException") {
			console.error("❌ Bedrock Throttling - Too many requests");
		} else if (error.code === "NetworkError") {
			console.error("❌ Network Error - Check your internet connection");
		}

		res.status(500).json({
			success: false,
			error: `Chat processing failed: ${error.message}`,
			errorType: error.constructor.name,
		});
	}
});

// Also add this test endpoint to verify Bedrock connection
app.post("/api/test-chat", async (req, res) => {
	try {
		console.log("=== Testing Bedrock Connection ===");

		if (!bedrockClient) {
			return res.status(500).json({
				success: false,
				error: "Bedrock client not initialized",
			});
		}

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

		console.log("Making test call to Bedrock...");
		const command = new InvokeModelCommand(input);
		const response = await bedrockClient.send(command);
		const responseBody = JSON.parse(
			new TextDecoder().decode(response.body)
		);

		console.log("✓ Bedrock test successful");
		res.json({
			success: true,
			message: "Bedrock connection working",
			reply: responseBody.content[0].text,
		});
	} catch (error) {
		console.error("❌ Bedrock test failed:", error);
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
		console.log("Connecting to repository:", repoUrl);

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

// API endpoint to generate documentation
app.post("/api/generate-documentation", async (req, res) => {
	try {
		console.log("Documentation generation request received");
		const { owner, repo, branch, fileStructure } = req.body;

		if (!owner || !repo || !fileStructure) {
			console.error("Missing required parameters:", {
				owner: !!owner,
				repo: !!repo,
				fileStructure: !!fileStructure,
			});
			return res.status(400).json({
				success: false,
				error: "Missing required parameters",
			});
		}

		console.log(`Generating documentation for ${owner}/${repo}...`);
		console.log(
			`File structure contains ${fileStructure.length} top-level items`
		);

		// Check if we have documentation cached
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

		console.log(
			"Starting documentation generation with repository:",
			repository
		);

		// Generate documentation
		const documentation = await generateRepositoryDocumentation(
			repository,
			fileStructure
		);
		console.log("Documentation generation completed");

		// Convert to markdown
		console.log("Converting documentation to markdown");
		const markdown = convertToMarkdown(documentation);
		console.log("Markdown conversion completed");

		// Simplified response for debugging
		const simplifiedDocs = {
			json: {
				repository: documentation.repository,
				generated: documentation.generated,
				summary: documentation.summary,
				fileCount: Object.keys(documentation.files).length,
				fileNames: Object.keys(documentation.files),
			},
			markdownLength: markdown.length,
		};

		console.log("Documentation generated:", simplifiedDocs);

		// Cache the result
		documentationCache[cacheKey] = {
			json: documentation,
			markdown,
		};

		console.log("Sending documentation response");
		res.json({
			success: true,
			documentation: {
				json: documentation,
				markdown,
			},
		});
	} catch (error) {
		console.error("Error generating documentation:", error);
		res.status(500).json({
			success: false,
			error: error.message || "Failed to generate documentation",
		});
	}
});

// Simple endpoint to check if server is running
app.get("/api/health", (req, res) => {
	res.json({
		status: "ok",
		message: "Documentation generator server is running",
		version: "1.0.0",
	});
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
