/**
 * Mock AI service for testing without AWS credentials
 */
class MockAiService {
	constructor() {
		this.mockResponses = {
			fileDocumentation: {
				overview: "This is a mock documentation generated for testing purposes.",
				purpose: "This file serves as an example component in the repository structure.",
				dependencies: ["React", "Express", "Node.js"],
				components: [
					{
						name: "MockFunction",
						type: "function",
						description: "A sample function that demonstrates the code structure",
						params: [
							{
								name: "input",
								type: "string",
								description: "Sample input parameter"
							}
						],
						returns: {
							type: "object",
							description: "Returns a sample response object"
						},
						examples: [
							"const result = MockFunction('example');"
						]
					}
				],
				notes: "This is mock documentation. To get real AI-generated docs, configure AWS credentials."
			},
			repositorySummary: {
				summary: "This appears to be a web application with both frontend and backend components. The project includes React components for the UI and Express.js for the API layer.",
				mainComponents: [
					"Frontend React Application",
					"Backend Express.js API",
					"Database Integration Layer",
					"Authentication System"
				],
				architecture: "Full-stack web application with client-server architecture",
				technologies: ["React", "Node.js", "Express.js", "JavaScript"],
				useCases: [
					"Web application development",
					"API-driven applications",
					"Full-stack JavaScript projects"
				]
			},
			chatResponses: [
				"This is a mock response. The repository appears to be a web application with both frontend and backend components.",
				"Based on the mock documentation, this project uses React for the frontend and Express.js for the backend.",
				"The architecture follows a typical client-server pattern with a JavaScript-based tech stack.",
				"For detailed code analysis, you'll need to configure AWS credentials to access Claude AI.",
				"This mock response simulates how the AI would analyze and explain your code structure."
			]
		};
	}

	async generateFileDocumentation(fileContent, filePath, repo) {
		// Simulate API delay
		await this.delay(500);

		const doc = { ...this.mockResponses.fileDocumentation };
		
		// Customize based on file type
		if (filePath.includes('.js') || filePath.includes('.jsx')) {
			doc.overview = `Mock documentation for JavaScript file: ${filePath}`;
			doc.dependencies = ["React", "JavaScript ES6+"];
		} else if (filePath.includes('.py')) {
			doc.overview = `Mock documentation for Python file: ${filePath}`;
			doc.dependencies = ["Python 3.x", "Flask/Django"];
		} else if (filePath.includes('.java')) {
			doc.overview = `Mock documentation for Java file: ${filePath}`;
			doc.dependencies = ["Java JDK", "Spring Framework"];
		}

		// Add metadata
		doc.metadata = {
			filePath,
			fileType: this.getFileType(filePath),
			generatedAt: new Date().toISOString(),
			repositoryInfo: {
				owner: repo.owner,
				name: repo.name,
				branch: repo.defaultBranch,
			},
			mockGenerated: true
		};

		return doc;
	}

	async generateRepositorySummary(documentation, repo) {
		// Simulate API delay
		await this.delay(1000);

		const summary = { ...this.mockResponses.repositorySummary };
		
		// Customize based on repo
		summary.summary = `Mock summary for ${repo.owner}/${repo.name}: ${summary.summary}`;
		
		return summary;
	}

	async callClaude(prompt, maxTokens = 1500) {
		// Simulate API delay
		await this.delay(800);

		// Return a contextual mock response
		const responses = this.mockResponses.chatResponses;
		const randomResponse = responses[Math.floor(Math.random() * responses.length)];
		
		// Add some context based on the prompt
		if (prompt.toLowerCase().includes('what does') || prompt.toLowerCase().includes('overview')) {
			return "This is a mock response. Based on the repository structure, this appears to be a full-stack web application with React frontend and Node.js backend components.";
		} else if (prompt.toLowerCase().includes('how to') || prompt.toLowerCase().includes('install')) {
			return "Mock response: To get started with this project, you would typically run 'npm install' for dependencies and 'npm start' to run the development server. (This is a simulated response - configure AWS for real AI analysis)";
		} else if (prompt.toLowerCase().includes('file') || prompt.toLowerCase().includes('function')) {
			return "Mock response: This file appears to contain core application logic. For detailed code analysis, please configure AWS Bedrock credentials to access Claude AI.";
		}
		
		return randomResponse;
	}

	getFileType(filePath) {
		const extension = filePath.split('.').pop().toLowerCase();
		const typeMap = {
			'js': 'JavaScript',
			'jsx': 'React Component',
			'ts': 'TypeScript',
			'tsx': 'TypeScript React',
			'py': 'Python',
			'java': 'Java',
			'go': 'Go',
			'rs': 'Rust',
			'php': 'PHP'
		};
		return typeMap[extension] || 'Unknown';
	}

	delay(ms) {
		return new Promise(resolve => setTimeout(resolve, ms));
	}
}

export default MockAiService;