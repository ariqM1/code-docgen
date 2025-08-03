import ChatService from "./chatService.js";

/**
 * Enhanced chat service with better repository understanding and question types
 */
class EnhancedChatService extends ChatService {
	constructor(config) {
		super(config);
		this.questionTypes = {
			OVERVIEW: "overview",
			SPECIFIC_FILE: "specific_file", 
			DEBUGGING: "debugging",
			ARCHITECTURE: "architecture",
			HOW_TO: "how_to",
			COMPARISON: "comparison",
			GENERAL: "general"
		};
	}

	/**
	 * Classify the type of question being asked
	 */
	classifyQuestion(message) {
		const messageLower = message.toLowerCase();

		// Overview questions
		if (this.matchesPatterns(messageLower, [
			"what does this", "what is this", "overview", "summary", "explain the project",
			"what does the repo", "purpose of this"
		])) {
			return this.questionTypes.OVERVIEW;
		}

		// Specific file questions
		if (this.matchesPatterns(messageLower, [
			"file", "function", "class", "method", "variable", ".py", ".js", ".ts", ".java"
		])) {
			return this.questionTypes.SPECIFIC_FILE;
		}

		// Debugging questions
		if (this.matchesPatterns(messageLower, [
			"error", "bug", "issue", "problem", "fix", "debug", "broken", "not working",
			"failing", "exception", "crash", "troubleshoot"
		])) {
			return this.questionTypes.DEBUGGING;
		}

		// Architecture questions
		if (this.matchesPatterns(messageLower, [
			"architecture", "structure", "design", "pattern", "organized", "modules",
			"components", "how is", "organized"
		])) {
			return this.questionTypes.ARCHITECTURE;
		}

		// How-to questions
		if (this.matchesPatterns(messageLower, [
			"how to", "how do i", "how can i", "step", "tutorial", "guide", "install",
			"setup", "configure", "run", "execute"
		])) {
			return this.questionTypes.HOW_TO;
		}

		// Comparison questions
		if (this.matchesPatterns(messageLower, [
			"difference", "compare", "vs", "versus", "alternative", "similar",
			"better than", "why use"
		])) {
			return this.questionTypes.COMPARISON;
		}

		return this.questionTypes.GENERAL;
	}

	/**
	 * Helper to match patterns in text
	 */
	matchesPatterns(text, patterns) {
		return patterns.some(pattern => text.includes(pattern));
	}

	/**
	 * Create enhanced prompt based on question type
	 */
	createEnhancedChatPrompt(userMessage, repoContext, relevantFiles, conversationContext, questionType) {
		const basePrompt = this.getBasePromptForQuestionType(questionType, repoContext);
		
		let prompt = `${basePrompt}

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
		}`;

		// Add relevant files based on question type
		if (relevantFiles && relevantFiles.length > 0) {
			prompt += "\n\nRelevant files for your question:\n";
			relevantFiles.forEach((file, index) => {
				prompt += `\n${index + 1}. ${file.path}\n`;
				prompt += `   Overview: ${file.doc.overview || "No overview"}\n`;
				
				if (questionType === this.questionTypes.SPECIFIC_FILE || questionType === this.questionTypes.DEBUGGING) {
					if (file.doc.purpose) prompt += `   Purpose: ${file.doc.purpose}\n`;
					if (file.doc.components && file.doc.components.length > 0) {
						prompt += "   Key components:\n";
						file.doc.components.slice(0, 2).forEach((comp) => {
							prompt += `   - ${comp.name} (${comp.type}): ${comp.description}\n`;
						});
					}
				}
			});
		}

		// Add conversation context
		if (conversationContext) {
			prompt += conversationContext;
		}

		// Add question-specific guidance
		prompt += this.getQuestionSpecificGuidance(questionType);

		prompt += `\n\nUser question: ${userMessage}\n\nResponse:`;

		return prompt;
	}

	/**
	 * Get base prompt template for different question types
	 */
	getBasePromptForQuestionType(questionType, repoContext) {
		switch (questionType) {
			case this.questionTypes.OVERVIEW:
				return `You are a helpful AI assistant specialized in providing clear overviews of code repositories. Focus on explaining the project's purpose, main functionality, and key features.`;
			
			case this.questionTypes.SPECIFIC_FILE:
				return `You are a helpful AI assistant specialized in explaining specific files and code components. Provide detailed explanations about functions, classes, and their usage.`;
			
			case this.questionTypes.DEBUGGING:
				return `You are a helpful AI assistant specialized in debugging and troubleshooting. Analyze the issue and provide specific solutions, common causes, and debugging steps.`;
			
			case this.questionTypes.ARCHITECTURE:
				return `You are a helpful AI assistant specialized in explaining software architecture and design patterns. Focus on the overall structure, organization, and design decisions.`;
			
			case this.questionTypes.HOW_TO:
				return `You are a helpful AI assistant specialized in providing step-by-step guidance. Give clear, actionable instructions for setup, configuration, and usage.`;
			
			case this.questionTypes.COMPARISON:
				return `You are a helpful AI assistant specialized in making technical comparisons. Explain differences, similarities, and trade-offs clearly.`;
			
			default:
				return `You are a helpful AI assistant specialized in explaining and helping with code repositories. Provide accurate, helpful responses based on the repository documentation.`;
		}
	}

	/**
	 * Get question-specific response guidance
	 */
	getQuestionSpecificGuidance(questionType) {
		switch (questionType) {
			case this.questionTypes.OVERVIEW:
				return `\n\nProvide a clear, concise overview including:
- What the project does
- Main features and capabilities
- Target use cases
- Key technologies used`;

			case this.questionTypes.SPECIFIC_FILE:
				return `\n\nWhen explaining code:
- Reference specific file paths and line numbers when possible
- Explain the purpose and functionality
- Mention dependencies and relationships
- Provide usage examples if relevant`;

			case this.questionTypes.DEBUGGING:
				return `\n\nFor debugging help:
- Identify potential causes
- Suggest specific debugging steps
- Mention relevant files to check
- Provide code examples if helpful`;

			case this.questionTypes.ARCHITECTURE:
				return `\n\nFor architecture questions:
- Explain the overall structure
- Describe key design patterns
- Mention component relationships
- Discuss design decisions and trade-offs`;

			case this.questionTypes.HOW_TO:
				return `\n\nProvide step-by-step instructions:
- Break down into clear steps
- Include command examples
- Mention prerequisites
- Provide troubleshooting tips`;

			case this.questionTypes.COMPARISON:
				return `\n\nFor comparisons:
- Highlight key differences
- Explain pros and cons
- Mention use case scenarios
- Be objective and balanced`;

			default:
				return `\n\nIMPORTANT: Keep your response under 4 sentences. Use straightforward language. Be direct and specific.`;
		}
	}

	/**
	 * Find relevant files with enhanced scoring based on question type
	 */
	findRelevantFilesEnhanced(message, documentedFiles, questionType) {
		const baseRelevantFiles = super.findRelevantFiles(message, documentedFiles);
		
		// Adjust scoring based on question type
		if (questionType === this.questionTypes.OVERVIEW) {
			// For overview, prefer main/entry files
			return this.prioritizeMainFiles(baseRelevantFiles);
		} else if (questionType === this.questionTypes.ARCHITECTURE) {
			// For architecture, prefer config and main structural files
			return this.prioritizeArchitecturalFiles(baseRelevantFiles);
		}

		return baseRelevantFiles;
	}

	/**
	 * Prioritize main entry files for overview questions
	 */
	prioritizeMainFiles(files) {
		const mainFilePatterns = [
			/main\./i, /index\./i, /app\./i, /server\./i, 
			/README/i, /setup/i, /config/i
		];

		return files.sort((a, b) => {
			const aIsMain = mainFilePatterns.some(pattern => pattern.test(a.path));
			const bIsMain = mainFilePatterns.some(pattern => pattern.test(b.path));
			
			if (aIsMain && !bIsMain) return -1;
			if (!aIsMain && bIsMain) return 1;
			return 0;
		});
	}

	/**
	 * Prioritize architectural files
	 */
	prioritizeArchitecturalFiles(files) {
		const archPatterns = [
			/config/i, /setup/i, /package\.json/i, /requirements/i,
			/docker/i, /makefile/i, /gradle/i, /pom\.xml/i
		];

		return files.sort((a, b) => {
			const aIsArch = archPatterns.some(pattern => pattern.test(a.path));
			const bIsArch = archPatterns.some(pattern => pattern.test(b.path));
			
			if (aIsArch && !bIsArch) return -1;
			if (!aIsArch && bIsArch) return 1;
			return 0;
		});
	}

	/**
	 * Generate follow-up questions based on the conversation
	 */
	generateFollowUpQuestions(userMessage, repoContext, questionType) {
		const followUps = [];

		switch (questionType) {
			case this.questionTypes.OVERVIEW:
				followUps.push(
					"How do I get started with this project?",
					"What are the main dependencies?",
					"How is the project structured?"
				);
				break;

			case this.questionTypes.SPECIFIC_FILE:
				followUps.push(
					"How is this file used in the project?",
					"What other files depend on this?",
					"Are there any similar functions in other files?"
				);
				break;

			case this.questionTypes.DEBUGGING:
				followUps.push(
					"What are common issues with this?",
					"How can I test if this is working correctly?",
					"Are there any known limitations?"
				);
				break;

			case this.questionTypes.HOW_TO:
				followUps.push(
					"What are the prerequisites?",
					"Are there any configuration options?",
					"How do I troubleshoot if it doesn't work?"
				);
				break;
		}

		return followUps.slice(0, 3); // Return top 3 suggestions
	}
}

export default EnhancedChatService;