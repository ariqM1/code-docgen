import { ChatBedrock } from "@langchain/community/chat_models/bedrock";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { PromptTemplate } from "@langchain/core/prompts";
import { modelId, validateAwsConfig } from "../utils/awsConfig";

// Initialize the Bedrock model with proper configuration
export const initializeModel = () => {
	// Check if AWS is properly configured
	if (!validateAwsConfig()) {
		throw new Error(
			"AWS configuration is incomplete. Please check your .env file."
		);
	}

	return new ChatBedrock({
		model: modelId,
		region: process.env.AWS_REGION || "us-east-1",
		credentials: {
			accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
			secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
		},
		maxTokens: 4096,
	});
};

// Generate documentation for code
export const generateDocumentation = async (
	codeContent: string,
	filePath: string
) => {
	try {
		const model = initializeModel();
		const parser = new StringOutputParser();

		const documentationPrompt = PromptTemplate.fromTemplate(`
      You are a technical documentation expert.
      Please document the following code:
      
      \`\`\`
      {codeContent}
      \`\`\`
      
      File path: {filePath}
      
      Provide:
      1. An overview of what this code does
      2. Detailed explanation of the key functions, classes and their parameters
      3. Potential edge cases or considerations
      
      Format your response in Markdown.
    `);

		const chain = documentationPrompt.pipe(model).pipe(parser);

		const response = await chain.invoke({
			codeContent,
			filePath,
		});

		return response;
	} catch (error) {
		console.error("Error generating documentation:", error);
		throw new Error("Failed to generate documentation");
	}
};

// Generate repository overview
export const generateRepositoryOverview = async (
	files: Array<{ path: string; content: string }>
) => {
	try {
		const model = initializeModel();
		const parser = new StringOutputParser();

		// Create a summary of all files
		const filesSummary = files.map((file) => `${file.path}`).join("\n");

		const overviewPrompt = PromptTemplate.fromTemplate(`
      You are a technical documentation expert.
      Please provide an overview of this repository based on the file structure:
      
      \`\`\`
      {filesSummary}
      \`\`\`
      
      Generate a concise overview that explains:
      1. The purpose of this repository
      2. Main technologies used
      3. Overall architecture
      
      Keep your response under 300 words.
    `);

		const chain = overviewPrompt.pipe(model).pipe(parser);

		const response = await chain.invoke({
			filesSummary,
		});

		return response;
	} catch (error) {
		console.error("Error generating repository overview:", error);
		throw new Error("Failed to generate repository overview");
	}
};

// This is a placeholder for fetching repository code
// In a real application, you'd implement GitHub API integration here
export const fetchRepositoryCode = async (repoUrl: string) => {
	console.log(`Fetching code from repository: ${repoUrl}`);

	// Return mock data for now
	return {
		name: "example-repo",
		owner: "username",
		files: [
			{
				path: "src/App.tsx",
				content: `import React from 'react';
import { Routes, Route } from 'react-router-dom';
import './App.css';

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <h1>Example Application</h1>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<About />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;`,
			},
			{
				path: "src/components/Header.tsx",
				content: `import React from 'react';
import './Header.css';

interface HeaderProps {
  title: string;
}

const Header: React.FC<HeaderProps> = ({ title }) => {
  return (
    <header className="header">
      <h1>{title}</h1>
      <nav>
        <ul>
          <li><a href="/">Home</a></li>
          <li><a href="/about">About</a></li>
        </ul>
      </nav>
    </header>
  );
};

export default Header;`,
			},
		],
	};
};
