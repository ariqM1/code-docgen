import axios from "axios";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import BedrockTest from "../component/BedrockTest";
import "./Dashboard.css";

// Define TypeScript interfaces
interface FileNode {
	path: string;
	type: "file" | "directory";
	children?: FileNode[];
}

interface Repository {
	owner: string;
	name: string;
	url: string;
	description: string | null;
	defaultBranch: string;
	fileStructure: FileNode[];
}

const Dashboard = () => {
	// State for repository connection
	const [repoUrl, setRepoUrl] = useState<string>("");
	const [isLoading, setIsLoading] = useState<boolean>(false);
	const [error, setError] = useState<string | null>(null);
	const [repository, setRepository] = useState<Repository | null>(null);
	const [isGeneratingDoc, setIsGeneratingDoc] = useState<boolean>(false);

	const navigate = useNavigate();

	// API client configuration
	const API_URL =
		process.env.REACT_APP_API_URL || "http://localhost:4000/api";

	// Connect to GitHub repository
	const connectToRepository = async (e: React.FormEvent) => {
		e.preventDefault();

		if (!repoUrl) {
			setError("Please enter a GitHub repository URL");
			return;
		}

		try {
			setIsLoading(true);
			setError(null);

			// Call the backend API to connect to the repository
			const response = await axios.post(`${API_URL}/connect-repository`, {
				repoUrl,
			});

			// Check for success
			if (response.data.success) {
				const repo = response.data.repository;
				setRepository(repo);
				console.log("Connected to repository:", repo);

				// Store repository in session storage for use in documentation view
				sessionStorage.setItem("repository", JSON.stringify(repo));
			} else {
				throw new Error(
					response.data.error || "Failed to connect to repository"
				);
			}
		} catch (error: any) {
			console.error("Error connecting to repository:", error);
			setError(
				error.response?.data?.error ||
					error.message ||
					"Failed to connect to repository"
			);
		} finally {
			setIsLoading(false);
		}
	};

	// Generate documentation
	const generateDocumentation = async () => {
		if (!repository) return;

		try {
			setIsGeneratingDoc(true);
			setError(null);

			// Navigate to documentation view
			// The actual generation will happen in the DocumentationView component
			navigate("/documentation");
		} catch (error: any) {
			console.error("Error navigating to documentation view:", error);
			setError("Failed to navigate to documentation view");
			setIsGeneratingDoc(false);
		}
	};

	// Reset connection to try another repository
	const resetConnection = () => {
		setRepository(null);
		setRepoUrl("");
		// Clear from session storage
		sessionStorage.removeItem("repository");
	};

	// Count files in the repository structure
	const countFiles = (fileStructure: FileNode[] | undefined): number => {
		if (!fileStructure || !Array.isArray(fileStructure)) {
			return 0;
		}

		return fileStructure.reduce((count, item) => {
			if (item.type === "file") {
				return count + 1;
			} else if (
				item.type === "directory" &&
				Array.isArray(item.children)
			) {
				return count + countFiles(item.children);
			}
			return count;
		}, 0);
	};

	return (
		<div className="dashboard-container">
			<div className="dashboard-content">
				<h1>AI Code Documentation Generator</h1>
				<p className="dashboard-description">
					Generate comprehensive documentation for your GitHub
					repositories using AI. Our tool analyzes your code and
					creates detailed documentation with explanations, usage
					examples, and more.
				</p>

				{!repository ? (
					// Step 1: Connect to repository form
					<div className="repository-connection">
						<h2>Connect to GitHub Repository</h2>
						<form onSubmit={connectToRepository}>
							<div className="input-group">
								<input
									type="text"
									value={repoUrl}
									onChange={(e) => setRepoUrl(e.target.value)}
									placeholder="https://github.com/username/repository"
									disabled={isLoading}
									className="repo-input"
								/>
								<button
									type="submit"
									className="generate-button"
									disabled={isLoading}
								>
									{isLoading
										? "Connecting..."
										: "Connect Repository"}
								</button>
							</div>

							{error && (
								<div className="error-message">{error}</div>
							)}
						</form>
					</div>
				) : (
					// Step 2: Repository connected, show info
					<div className="repository-info">
						<h2>Repository Connected</h2>
						<div className="repository-details">
							<p>
								<strong>Name:</strong> {repository.owner}/
								{repository.name}
							</p>
							<p>
								<strong>Description:</strong>{" "}
								{repository.description ||
									"No description provided"}
							</p>
							<p>
								<strong>Default Branch:</strong>{" "}
								{repository.defaultBranch}
							</p>
							<p>
								<strong>Files:</strong>{" "}
								{countFiles(repository.fileStructure)} files
								found
							</p>
						</div>

						<div className="repository-actions">
							<button
								className="generate-button"
								onClick={generateDocumentation}
								disabled={isGeneratingDoc}
							>
								{isGeneratingDoc
									? "Processing..."
									: "Generate Documentation"}
							</button>

							<button
								className="reset-button"
								onClick={resetConnection}
								disabled={isLoading || isGeneratingDoc}
							>
								Connect Different Repository
							</button>
						</div>
					</div>
				)}

				<div className="dashboard-features">
					<h2>Features</h2>
					<ul>
						<li>Detailed function and class documentation</li>
						<li>Interactive code exploration</li>
						<li>Support for multiple programming languages</li>
						<li>Ask questions about your code</li>
					</ul>
				</div>

				<BedrockTest />
			</div>
		</div>
	);
};

export default Dashboard;
