import ApiService from "./apiService";
import type { FileNode } from "../types";

// Interface for file documentation
export interface FileDocumentation {
	path: string;
	content: string;
	documentation: string;
}

// Interface for repository documentation
export interface RepositoryDocumentation {
	overview: string;
	files: FileDocumentation[];
}

// Interface for code query responses
export interface CodeQueryResponse {
	answer: string;
	relatedFiles: string[];
}

class BedrockService {
	/**
	 * Tests the connection to AWS Bedrock
	 */
	static async testConnection(): Promise<string> {
		try {
			return await ApiService.testBedrockConnection();
		} catch (error) {
			console.error("Error testing Bedrock connection:", error);
			throw new Error("Failed to connect to AWS Bedrock");
		}
	}

	/**
	 * Generate documentation for a single file
	 */
	static async documentFile(
		filePath: string,
		fileContent: string
	): Promise<string> {
		try {
			return await ApiService.generateFileDocumentation(
				fileContent,
				filePath
			);
		} catch (error) {
			console.error(
				`Error generating documentation for ${filePath}:`,
				error
			);
			throw new Error(`Failed to generate documentation for ${filePath}`);
		}
	}

	/**
	 * Generate an overview of the repository structure
	 */
	static async generateOverview(
		owner: string,
		repo: string,
		fileStructure: FileNode[]
	): Promise<string> {
		try {
			return await ApiService.generateRepositoryOverview(
				owner,
				repo,
				fileStructure
			);
		} catch (error) {
			console.error("Error generating repository overview:", error);
			throw new Error("Failed to generate repository overview");
		}
	}

	/**
	 * Process a repository to generate comprehensive documentation
	 */
	static async processRepository(
		owner: string,
		repo: string,
		fileStructure: FileNode[],
		fileContents: Map<string, string>
	): Promise<RepositoryDocumentation> {
		try {
			console.log(
				`Processing repository ${owner}/${repo} with ${fileContents.size} files`
			);

			// Generate documentation for all files through ApiService
			return await ApiService.generateRepositoryDocumentation(
				owner,
				repo,
				fileStructure,
				fileContents
			);
		} catch (error) {
			console.error("Error processing repository:", error);
			throw new Error(
				"Failed to process repository and generate documentation"
			);
		}
	}

	/**
	 * Answer questions about the codebase using the documentation context
	 */
	static async answerCodeQuestion(
		owner: string,
		repo: string,
		question: string,
		context: {
			files: FileDocumentation[];
			fileStructure: FileNode[];
		}
	): Promise<string> {
		try {
			console.log(
				`Answering question about ${owner}/${repo}: "${question}"`
			);
			return await ApiService.askCodeQuestion(
				owner,
				repo,
				question,
				context
			);
		} catch (error) {
			console.error("Error answering code question:", error);
			throw new Error("Failed to answer the question about the codebase");
		}
	}

	/**
	 * Determine which files are most relevant to a particular question or topic
	 */
	static findRelevantFiles(
		query: string,
		documentation: RepositoryDocumentation
	): string[] {
		const relevantFiles: string[] = [];

		// Simple keyword matching for now
		// In a more advanced implementation, this would use embeddings or semantic search
		const keywords = query.toLowerCase().split(/\s+/);

		documentation.files.forEach((file) => {
			// Check if the documentation contains any of the keywords
			const docText = file.documentation.toLowerCase();
			const containsKeywords = keywords.some((keyword) =>
				docText.includes(keyword)
			);

			if (containsKeywords) {
				relevantFiles.push(file.path);
			}
		});

		return relevantFiles;
	}

	/**
	 * Generate a quick reference guide for the repository
	 * This is a helpful summary of key components and usage patterns
	 */
	static async generateQuickReference(
		owner: string,
		repo: string,
		documentation: RepositoryDocumentation
	): Promise<string> {
		try {
			// In a real implementation, this would call the API
			// For now, we'll construct a simple reference from the existing documentation

			let reference = `# Quick Reference Guide for ${owner}/${repo}\n\n`;
			reference += `## Overview\n\n${documentation.overview
				.split("\n")
				.slice(0, 5)
				.join("\n")}\n\n`;
			reference += "## Key Components\n\n";

			// Extract 5 most important files based on documentation length as a heuristic
			const keyFiles = [...documentation.files]
				.sort((a, b) => b.documentation.length - a.documentation.length)
				.slice(0, 5);

			keyFiles.forEach((file) => {
				const name = file.path.split("/").pop() || file.path;
				const firstParagraph = file.documentation.split("\n\n")[0];
				reference += `### ${name}\n\n${firstParagraph}\n\n`;
			});

			return reference;
		} catch (error) {
			console.error("Error generating quick reference:", error);
			throw new Error("Failed to generate quick reference guide");
		}
	}
}

export default BedrockService;
