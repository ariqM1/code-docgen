import axios from "axios";
import type {
	FileDocumentation,
	RepositoryDocumentation,
} from "./bedrockService";

/**
 * API Service for communicating with the backend
 * Handles all HTTP requests to our server endpoints
 */

// Create API service instance with base configuration
const API_BASE_URL =
	process.env.REACT_APP_API_URL || "http://localhost:4000/api";

const apiClient = axios.create({
	baseURL: API_BASE_URL,
	headers: {
		"Content-Type": "application/json",
	},
	timeout: 60000, // 60 second timeout for long documentation generations
});

class ApiService {
	/**
	 * Test the connection to AWS Bedrock via backend
	 */
	static async testBedrockConnection(): Promise<string> {
		try {
			const response = await apiClient.post("/test-bedrock");

			if (!response.data.success) {
				throw new Error(
					response.data.error || "Failed to connect to Bedrock"
				);
			}

			return response.data.message;
		} catch (error) {
			console.error("Error testing Bedrock connection:", error);
			throw new Error(
				"Failed to connect to AWS Bedrock. Please check your credentials."
			);
		}
	}

	/**
	 * Connect to a GitHub repository and retrieve its structure
	 */
	static async connectToRepository(repoUrl: string): Promise<RepositoryData> {
		try {
			const response = await apiClient.post("/connect-repository", {
				repoUrl,
			});

			if (!response.data.success) {
				throw new Error(
					response.data.error || "Failed to connect to repository"
				);
			}

			return response.data.repository;
		} catch (error: any) {
			console.error("Error connecting to repository:", error);
			const errorMessage =
				error.response?.data?.error ||
				(error instanceof Error
					? error.message
					: "Failed to connect to repository");
			throw new Error(errorMessage);
		}
	}

	/**
	 * Get file content from GitHub via backend
	 */
	static async getFileContent(
		owner: string,
		repo: string,
		path: string,
		branch: string = "main"
	): Promise<string> {
		try {
			const response = await apiClient.post("/file-content", {
				owner,
				repo,
				path,
				branch,
			});

			if (!response.data.success) {
				throw new Error(
					response.data.error || "Failed to fetch file content"
				);
			}

			return response.data.content;
		} catch (error) {
			console.error(`Error fetching content for ${path}:`, error);
			throw new Error(`Failed to fetch content for ${path}`);
		}
	}

	/**
	 * Generate documentation for a specific file
	 */
	static async generateFileDocumentation(
		code: string,
		filePath: string
	): Promise<string> {
		try {
			const response = await apiClient.post("/generate-documentation", {
				code,
				filePath,
			});

			if (!response.data.success) {
				throw new Error(
					response.data.error || "Failed to generate documentation"
				);
			}

			return response.data.documentation;
		} catch (error) {
			console.error(
				`Error generating documentation for ${filePath}:`,
				error
			);
			throw new Error(`Failed to generate documentation for ${filePath}`);
		}
	}

	/**
	 * Generate repository overview
	 */
	static async generateRepositoryOverview(
		owner: string,
		repo: string,
		fileStructure: FileNode[]
	): Promise<string> {
		try {
			const response = await apiClient.post("/generate-overview", {
				owner,
				repo,
				fileStructure,
			});

			if (!response.data.success) {
				throw new Error(
					response.data.error || "Failed to generate overview"
				);
			}

			return response.data.overview;
		} catch (error) {
			console.error("Error generating repository overview:", error);
			throw new Error("Failed to generate repository overview");
		}
	}

	/**
	 * Generate comprehensive documentation for the entire repository
	 * This processes files in batches to avoid overwhelming the API
	 */
	static async generateRepositoryDocumentation(
		owner: string,
		repo: string,
		fileStructure: FileNode[],
		fileContents: Map<string, string>
	): Promise<RepositoryDocumentation> {
		try {
			// First, generate the overview
			const overview = await this.generateRepositoryOverview(
				owner,
				repo,
				fileStructure
			);

			// For each file, generate documentation
			const fileDocumentations: FileDocumentation[] = [];

			// Process files in batches
			const batchSize = 5;
			const filePaths = Array.from(fileContents.keys());

			for (let i = 0; i < filePaths.length; i += batchSize) {
				const batch = filePaths.slice(i, i + batchSize);

				// Process each file in parallel
				const batchPromises = batch.map(async (filePath) => {
					const content = fileContents.get(filePath) || "";

					// Skip non-code files or files that are too large
					if (this.shouldSkipFile(filePath, content)) {
						console.log(
							`Skipping file ${filePath} (size: ${content.length} bytes)`
						);
						return null;
					}

					try {
						console.log(`Generating documentation for ${filePath}`);
						const documentation =
							await this.generateFileDocumentation(
								content,
								filePath
							);

						return {
							path: filePath,
							content,
							documentation,
						};
					} catch (error) {
						console.error(`Error processing ${filePath}:`, error);
						return null;
					}
				});

				const batchResults = await Promise.all(batchPromises);

				// Add valid results to the documentation array
				batchResults.forEach((result) => {
					if (result) {
						fileDocumentations.push(result);
					}
				});

				// Log progress
				console.log(
					`Processed ${i + batch.length}/${filePaths.length} files`
				);
			}

			return {
				overview,
				files: fileDocumentations,
			};
		} catch (error) {
			console.error("Error generating repository documentation:", error);
			throw new Error(
				"Failed to generate complete repository documentation"
			);
		}
	}

	/**
	 * Answer a question about the codebase using AI
	 */
	static async askCodeQuestion(
		owner: string,
		repo: string,
		question: string,
		context: {
			files: FileDocumentation[];
			fileStructure: FileNode[];
		}
	): Promise<string> {
		try {
			const response = await apiClient.post("/ask-question", {
				owner,
				repo,
				question,
				context,
			});

			if (!response.data.success) {
				throw new Error(
					response.data.error || "Failed to answer the question"
				);
			}

			return response.data.answer;
		} catch (error) {
			console.error("Error answering code question:", error);
			throw new Error(
				"Failed to answer the question. Please try rephrasing or providing more context."
			);
		}
	}

	/**
	 * Determine whether to skip a file based on its type and size
	 */
	private static shouldSkipFile(filePath: string, content: string): boolean {
		// Skip files that are too large (e.g., over 100KB)
		if (content.length > 100000) {
			return true;
		}

		// Skip binary files and non-code files
		const extension = filePath.split(".").pop()?.toLowerCase();
		const skipExtensions = [
			// Images
			"jpg",
			"jpeg",
			"png",
			"gif",
			"svg",
			"ico",
			"webp",
			"bmp",
			// Documents
			"pdf",
			"doc",
			"docx",
			"xls",
			"xlsx",
			"ppt",
			"pptx",
			// Archives
			"zip",
			"tar",
			"gz",
			"rar",
			"7z",
			// Executables
			"exe",
			"dll",
			"so",
			"dylib",
			"bin",
			// Media
			"mp3",
			"mp4",
			"avi",
			"mov",
			"webm",
			"wav",
			"ogg",
			// Fonts
			"ttf",
			"woff",
			"woff2",
			"eot",
			"otf",
			// Data
			"dat",
			"bin",
			"sqlite",
			"db",
			// Lock files
			"lock",
		];

		if (extension && skipExtensions.includes(extension)) {
			return true;
		}

		// Check if the file might be a binary file by looking for null bytes
		if (content.includes("\0")) {
			return true;
		}

		return false;
	}
}

export default ApiService;
