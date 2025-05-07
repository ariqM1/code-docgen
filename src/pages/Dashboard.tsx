import axios from "axios";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import BedrockTest from "../component/BedrockTest";
import "./Dashboard.css";

const Dashboard = () => {
	// State for repository connection
	const [repoUrl, setRepoUrl] = useState<string>("");
	const [isLoading, setIsLoading] = useState<boolean>(false);
	const [error, setError] = useState<string | null>(null);
	const [repository, setRepository] = useState<any>(null);

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
				setRepository(response.data.repository);
				console.log(
					"Connected to repository:",
					response.data.repository
				);
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

	// Reset connection to try another repository
	const resetConnection = () => {
		setRepository(null);
		setRepoUrl("");
	};

	// Count files in the repository structure
	const countFiles = (fileStructure: any[]) => {
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
								onClick={() => {
									// In a full implementation, this would generate documentation
									console.log(
										"Generate documentation for:",
										repository
									);
								}}
								disabled={isLoading}
							>
								{isLoading
									? "Processing..."
									: "Generate Documentation"}
							</button>

							<button
								className="reset-button"
								onClick={resetConnection}
								disabled={isLoading}
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
