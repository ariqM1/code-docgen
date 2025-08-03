import axios from "axios";
import React, { useState } from "react";
import "./RepositoryConnector.css";

// Define TypeScript interfaces for our data structures
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

/**
 * Simple component to connect to a GitHub repository.
 * This component handles the repository URL input and connection process.
 */
const RepositoryConnector: React.FC = () => {
	// State with TypeScript types
	const [repoUrl, setRepoUrl] = useState<string>("");
	const [isLoading, setIsLoading] = useState<boolean>(false);
	const [error, setError] = useState<string | null>(null);
	const [repository, setRepository] = useState<Repository | null>(null);

	// API client
	const API_URL =
		process.env.REACT_APP_API_URL || "http://localhost:4000/api";

	// Handle form submission
	const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
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
	const resetConnection = (): void => {
		setRepository(null);
		setRepoUrl("");
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
		<div className="repository-connector">
			{!repository ? (
				// Step 1: Connect to repository form
				<>
					<h2>Connect to GitHub Repository</h2>
					<p>Enter the URL of a GitHub repository to begin.</p>

					<form onSubmit={handleSubmit}>
						<div className="input-group">
							<input
								type="text"
								value={repoUrl}
								onChange={(
									e: React.ChangeEvent<HTMLInputElement>
								) => setRepoUrl(e.target.value)}
								placeholder="https://github.com/username/repository"
								disabled={isLoading}
								className="repo-input"
							/>
							<button
								type="submit"
								disabled={isLoading}
								className="connect-button"
							>
								{isLoading ? "Connecting..." : "Connect"}
							</button>
						</div>

						{error && <div className="error-message">{error}</div>}
					</form>

					<div className="connection-help">
						<h3>Example URLs:</h3>
						<ul>
							<li>https://github.com/facebook/react</li>
							<li>https://github.com/nodejs/node</li>
						</ul>
					</div>
				</>
			) : (
				// Step 2: Repository connected, show info
				<div className="repository-info">
					<h2>Repository Connected!</h2>
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
							{countFiles(repository.fileStructure)} files found
						</p>
					</div>

					<div className="file-preview">
						<h3>Repository Structure:</h3>
						<div className="file-structure">
							<pre>
								{JSON.stringify(
									repository.fileStructure,
									null,
									2
								)}
							</pre>
						</div>
					</div>

					<button className="reset-button" onClick={resetConnection}>
						Connect to Different Repository
					</button>
				</div>
			)}
		</div>
	);
};

export default RepositoryConnector;
