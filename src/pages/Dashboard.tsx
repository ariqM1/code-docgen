import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Dashboard.css";

const Dashboard = () => {
	const [repoUrl, setRepoUrl] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const navigate = useNavigate();

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		if (!repoUrl) {
			setError("Please enter a repository URL");
			return;
		}

		// Basic validation for GitHub URL
		if (!repoUrl.includes("github.com")) {
			setError("Please enter a valid GitHub repository URL");
			return;
		}

		setIsLoading(true);
		setError(null);

		try {
			// In a real app, you would fetch repository details here
			// For now, we'll just simulate a delay and proceed
			await new Promise((resolve) => setTimeout(resolve, 1000));

			// Create a URL-safe encoding of the repository URL
			const repoId = encodeURIComponent(repoUrl);
			navigate(`/documentation/${repoId}`);
		} catch (err) {
			setError("Failed to process repository. Please try again.");
			console.error(err);
		} finally {
			setIsLoading(false);
		}
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

				<form onSubmit={handleSubmit} className="repo-form">
					<div className="input-group">
						<label htmlFor="repo-url">GitHub Repository URL</label>
						<input
							id="repo-url"
							type="text"
							value={repoUrl}
							onChange={(e) => setRepoUrl(e.target.value)}
							placeholder="https://github.com/username/repository"
							className="repo-input"
							disabled={isLoading}
						/>
						{error && <div className="error-message">{error}</div>}
					</div>

					<button
						type="submit"
						className="submit-button"
						disabled={isLoading}
					>
						{isLoading ? "Processing..." : "Generate Documentation"}
					</button>
				</form>

				<div className="dashboard-features">
					<h2>Features</h2>
					<ul>
						<li>Detailed function and class documentation</li>
						<li>Interactive code exploration</li>
						<li>Support for multiple programming languages</li>
						<li>Ask questions about your code</li>
					</ul>
				</div>
			</div>
		</div>
	);
};

export default Dashboard;
