import {
	BedrockRuntimeClient,
	InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";
import axios from "axios";

// File extensions and comment patterns for different languages
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

// Bedrock client for Claude
let bedrockClient = null;
let modelId = "";

// GitHub API client
let githubApi = null;

// Initialize the documentation generator
export function initDocumentationGenerator() {
	// Initialize Bedrock client
	bedrockClient = new BedrockRuntimeClient({
		region: process.env.AWS_REGION || "us-east-1",
		credentials: {
			accessKeyId: process.env.AWS_ACCESS_KEY_ID,
			secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
		},
	});

	// Set model ID for Claude
	modelId =
		process.env.BEDROCK_MODEL_ID ||
		"us.anthropic.claude-3-5-haiku-20241022-v1:0";

	// GitHub API configuration
	const githubToken = process.env.GITHUB_TOKEN || "";

	// Create GitHub API client
	githubApi = axios.create({
		baseURL: "https://api.github.com",
		headers: githubToken ? { Authorization: `token ${githubToken}` } : {},
	});
}

/**
 * Determine file language based on extension
 */
function getFileLanguage(filePath) {
	const extension = filePath
		.substring(filePath.lastIndexOf("."))
		.toLowerCase();

	for (const [lang, config] of Object.entries(LANGUAGE_CONFIG)) {
		if (config.extensions.includes(extension)) {
			return { language: lang, fileType: config.fileType };
		}
	}

	return { language: null, fileType: "Unknown" };
}

/**
 * Check if file should be documented
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
 * Fetch file content from GitHub
 */
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

/**
 * Generate documentation for a single file using Claude
 */
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

/**
 * Generate a summary of the repository based on individual file documentation
 */
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

/**
 * Generate documentation for repository files
 */
export async function generateRepositoryDocumentation(repo, fileStructure) {
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

		// Process files in batches to avoid rate limiting
		const batchSize = 3;
		for (let i = 0; i < filesToProcess.length; i += batchSize) {
			const batch = filesToProcess.slice(i, i + batchSize);

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

/**
 * Convert documentation to markdown
 */
export function convertToMarkdown(documentation) {
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
