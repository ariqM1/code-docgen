import {
	BedrockRuntimeClient,
	InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";
import GitHubService from "./services/githubService.js";
import MockAiService from "./services/mockAiService.js";

// Configuration constants
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
	go: {
		extensions: [".go"],
		fileType: "Go",
	},
	rust: {
		extensions: [".rs"],
		fileType: "Rust",
	},
	php: {
		extensions: [".php"],
		fileType: "PHP",
	},
};

const EXCLUDED_PATTERNS = [
	/node_modules/,
	/\.git/,
	/dist/,
	/build/,
	/__pycache__/,
	/\.DS_Store/,
	/\.env/,
	/\.log$/,
	/\.lock$/,
	/package-lock\.json$/,
	/yarn\.lock$/,
];

// Global instances
let bedrockClient = null;
let modelId = "";
let githubService = null;
let mockAiService = null;
let useMockMode = false;

// Processing configuration
const PROCESSING_CONFIG = {
	maxFiles: 10,
	batchSize: 3,
	maxTokens: 4000,
};

/**
 * Initialize the documentation generator with AWS and GitHub credentials
 */
export function initDocumentationGenerator() {
	// Check if we should use mock mode
	useMockMode = process.env.MOCK_AI_RESPONSES === "true" || 
				 !process.env.AWS_ACCESS_KEY_ID || 
				 !process.env.AWS_SECRET_ACCESS_KEY;

	if (useMockMode) {
		console.log("🎭 Using mock AI responses (AWS credentials not configured)");
		mockAiService = new MockAiService();
	} else {
		console.log("🤖 Using real Claude AI via AWS Bedrock");
		// Initialize Bedrock client
		try {
			bedrockClient = new BedrockRuntimeClient({
				region: process.env.AWS_REGION || "us-east-1",
				credentials: {
					accessKeyId: process.env.AWS_ACCESS_KEY_ID,
					secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
				},
			});
		} catch (error) {
			console.warn("⚠️ Failed to initialize Bedrock client, falling back to mock mode");
			useMockMode = true;
			mockAiService = new MockAiService();
		}
	}

	modelId = process.env.BEDROCK_MODEL_ID || "us.anthropic.claude-3-5-haiku-20241022-v1:0";
	
	// Initialize GitHub service
	githubService = new GitHubService(process.env.GITHUB_TOKEN || "");
}

/**
 * Determine file language and type based on extension
 */
function getFileLanguage(filePath) {
	const extension = filePath.substring(filePath.lastIndexOf(".")).toLowerCase();

	for (const [lang, config] of Object.entries(LANGUAGE_CONFIG)) {
		if (config.extensions.includes(extension)) {
			return { language: lang, fileType: config.fileType };
		}
	}

	return { language: null, fileType: "Unknown" };
}

/**
 * Check if a file should be documented based on patterns and language support
 */
function shouldDocumentFile(filePath) {
	// Check exclusion patterns
	if (EXCLUDED_PATTERNS.some((pattern) => pattern.test(filePath))) {
		return false;
	}

	// Check supported languages
	const { language } = getFileLanguage(filePath);
	return language !== null;
}

/**
 * Create documentation prompt for Claude
 */
function createDocumentationPrompt(fileContent, filePath, fileType, repoInfo) {
	return `You are a technical documentation expert. Please analyze this code file and provide comprehensive documentation for it.

File path: ${filePath}
File type: ${fileType}
Repository: ${repoInfo.owner}/${repoInfo.name}

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
}

/**
 * Parse JSON response from Claude with error handling
 */
function parseClaudeResponse(content) {
	const jsonMatch = content.match(/\`\`\`json\n([\s\S]*?)\n\`\`\`/) || content.match(/{[\s\S]*}/);

	if (jsonMatch) {
		try {
			const jsonStr = jsonMatch[1] || jsonMatch[0];
			return JSON.parse(jsonStr);
		} catch (e) {
			console.error("Error parsing JSON from Claude response:", e);
			return { error: "Could not parse documentation as JSON" };
		}
	}

	return {
		overview: content,
		error: "Documentation not in expected JSON format",
	};
}

/**
 * Generate documentation for a single file using Claude or mock service
 */
async function generateFileDocumentation(fileContent, filePath, repo) {
	try {
		console.log(`Generating documentation for ${filePath}...`);

		// Use mock service if in mock mode
		if (useMockMode) {
			return await mockAiService.generateFileDocumentation(fileContent, filePath, repo);
		}

		// Use real Claude AI
		const { fileType } = getFileLanguage(filePath);
		const prompt = createDocumentationPrompt(fileContent, filePath, fileType, repo);

		const input = {
			modelId,
			contentType: "application/json",
			accept: "application/json",
			body: JSON.stringify({
				anthropic_version: "bedrock-2023-05-31",
				max_tokens: PROCESSING_CONFIG.maxTokens,
				messages: [{ role: "user", content: prompt }],
			}),
		};

		const command = new InvokeModelCommand(input);
		const response = await bedrockClient.send(command);
		const responseBody = JSON.parse(new TextDecoder().decode(response.body));

		const content = responseBody.content[0].text;
		const docObject = parseClaudeResponse(content);

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
		console.error(`Error generating documentation for ${filePath}:`, error);
		
		// Fallback to mock service on error
		if (!useMockMode) {
			console.warn("🎭 Falling back to mock mode due to error");
			return await mockAiService.generateFileDocumentation(fileContent, filePath, repo);
		}
		
		return {
			error: `Error generating documentation for ${filePath}: ${error.message}`,
			filePath,
			generatedAt: new Date().toISOString(),
		};
	}
}

/**
 * Create repository summary prompt
 */
function createSummaryPrompt(fileOverviews, repo) {
	return `You are a technical documentation expert. Please create a high-level summary of this repository based on the documentation of its files.

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
}

/**
 * Generate repository summary based on individual file documentation
 */
async function generateRepositorySummary(documentation, repo) {
	try {
		console.log(`Generating repository summary for ${repo.owner}/${repo.name}...`);

		// Use mock service if in mock mode
		if (useMockMode) {
			return await mockAiService.generateRepositorySummary(documentation, repo);
		}

		// Use real Claude AI
		const fileOverviews = Object.entries(documentation.files).map(
			([path, doc]) => `- ${path}: ${doc.overview || "No overview"}`
		);

		const prompt = createSummaryPrompt(fileOverviews, repo);

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
		const responseBody = JSON.parse(new TextDecoder().decode(response.body));

		const content = responseBody.content[0].text;
		const jsonMatch = content.match(/\`\`\`json\n([\s\S]*?)\n\`\`\`/) || content.match(/{[\s\S]*}/);

		if (jsonMatch) {
			try {
				const jsonStr = jsonMatch[1] || jsonMatch[0];
				return JSON.parse(jsonStr);
			} catch (e) {
				console.error("Error parsing JSON from Claude response:", e);
				return {
					summary: "Could not generate repository summary in the expected format.",
					error: e.message,
				};
			}
		}

		return {
			summary: content,
			note: "Summary not in expected JSON format",
		};
	} catch (error) {
		console.error("Error generating repository summary:", error);
		
		// Fallback to mock service on error
		if (!useMockMode) {
			console.warn("🎭 Falling back to mock mode for summary due to error");
			return await mockAiService.generateRepositorySummary(documentation, repo);
		}
		
		return {
			summary: "Error generating repository summary",
			error: error.message,
		};
	}
}

/**
 * Recursively find all files that should be documented
 */
function findFilesToProcess(fileStructure) {
	const filesToProcess = [];

	const traverse = (files) => {
		for (const file of files) {
			if (file.type === "file" && shouldDocumentFile(file.path)) {
				filesToProcess.push(file.path);
			} else if (file.type === "directory" && Array.isArray(file.children)) {
				traverse(file.children);
			}
		}
	};

	traverse(fileStructure);
	return filesToProcess;
}

/**
 * Process files in batches to avoid rate limiting
 */
async function processFilesInBatches(filesToProcess, repo) {
	const documentation = {};
	const { batchSize } = PROCESSING_CONFIG;

	for (let i = 0; i < filesToProcess.length; i += batchSize) {
		const batch = filesToProcess.slice(i, i + batchSize);
		
		console.log(`Processing batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(filesToProcess.length / batchSize)}`);

		const batchPromises = batch.map(async (filePath) => {
			const fileContent = await githubService.fetchFileContent(
				repo.owner,
				repo.name,
				filePath,
				repo.defaultBranch
			);

			if (fileContent) {
				const fileDoc = await generateFileDocumentation(fileContent, filePath, repo);
				documentation[filePath] = fileDoc;
			}
		});

		await Promise.all(batchPromises);
	}

	return documentation;
}

/**
 * Generate documentation for repository files
 */
export async function generateRepositoryDocumentation(repo, fileStructure) {
	try {
		console.log(`Starting documentation generation for ${repo.owner}/${repo.name}`);

		// Initialize documentation object
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

		// Find files to process
		const allFiles = findFilesToProcess(fileStructure);
		console.log(`Found ${allFiles.length} files to document`);

		// Limit files for performance
		const filesToProcess = allFiles.slice(0, PROCESSING_CONFIG.maxFiles);
		if (allFiles.length > PROCESSING_CONFIG.maxFiles) {
			console.log(`Limiting to ${PROCESSING_CONFIG.maxFiles} files for performance`);
		}

		// Process files in batches
		documentation.files = await processFilesInBatches(filesToProcess, repo);

		// Generate repository summary
		documentation.summary = await generateRepositorySummary(documentation, repo);

		console.log(`Documentation generation completed for ${repo.owner}/${repo.name}`);
		return documentation;
	} catch (error) {
		console.error("Error generating repository documentation:", error);
		throw error;
	}
}

/**
 * Convert documentation to markdown format
 */
export function convertToMarkdown(documentation) {
	let markdown = `# ${documentation.repository.owner}/${documentation.repository.name}\n\n`;

	// Add repository summary
	if (documentation.summary) {
		markdown += addSummarySection(documentation.summary);
	}

	// Add table of contents
	markdown += addTableOfContents(documentation.files);

	// Add documentation for each file
	markdown += addFileDocumentation(documentation.files);

	// Add generation metadata
	markdown += `\n\n---\n\nGenerated on: ${new Date(documentation.generated).toLocaleString()}\n`;

	return markdown;
}

/**
 * Add summary section to markdown
 */
function addSummarySection(summary) {
	let markdown = `## Repository Summary\n\n${summary.summary || "No summary available"}\n\n`;

	if (summary.mainComponents) {
		markdown += `### Main Components\n\n`;
		summary.mainComponents.forEach((comp) => {
			markdown += `- ${comp}\n`;
		});
		markdown += "\n";
	}

	if (summary.architecture) {
		markdown += `### Architecture\n\n${summary.architecture}\n\n`;
	}

	if (summary.technologies) {
		markdown += `### Technologies\n\n`;
		summary.technologies.forEach((tech) => {
			markdown += `- ${tech}\n`;
		});
		markdown += "\n";
	}

	if (summary.useCases) {
		markdown += `### Use Cases\n\n`;
		summary.useCases.forEach((useCase) => {
			markdown += `- ${useCase}\n`;
		});
		markdown += "\n";
	}

	return markdown;
}

/**
 * Add table of contents to markdown
 */
function addTableOfContents(files) {
	let markdown = `## Files\n\n`;
	Object.keys(files)
		.sort()
		.forEach((filePath) => {
			const file = files[filePath];
			if (!file.error) {
				const anchor = encodeURIComponent(filePath);
				markdown += `- [${filePath}](#${anchor})\n`;
			}
		});
	return markdown + "\n";
}

/**
 * Add file documentation to markdown
 */
function addFileDocumentation(files) {
	let markdown = "";

	Object.keys(files)
		.sort()
		.forEach((filePath) => {
			const file = files[filePath];
			const anchor = encodeURIComponent(filePath);

			markdown += `<a id="${anchor}"></a>\n## ${filePath}\n\n`;

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
					markdown += addComponentDocumentation(component);
				});
			}

			if (file.notes) {
				markdown += `### Notes\n\n${file.notes}\n\n`;
			}

			markdown += `---\n\n`;
		});

	return markdown;
}

/**
 * Add component documentation to markdown
 */
function addComponentDocumentation(component) {
	let markdown = `#### ${component.name} (${component.type})\n\n${component.description}\n\n`;

	if (component.params && component.params.length > 0) {
		markdown += `**Parameters:**\n\n`;
		component.params.forEach((param) => {
			markdown += `- \`${param.name}\` (${param.type}): ${param.description}\n`;
		});
		markdown += "\n";
	}

	if (component.returns) {
		markdown += `**Returns:**\n\n- (${component.returns.type}): ${component.returns.description}\n\n`;
	}

	if (component.examples && component.examples.length > 0) {
		markdown += `**Examples:**\n\n`;
		component.examples.forEach((example) => {
			markdown += `\`\`\`\n${example}\n\`\`\`\n\n`;
		});
	}

	return markdown;
}