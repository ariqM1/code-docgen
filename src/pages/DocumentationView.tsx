import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import "./DocumentationView.css";

// Mock data for now - in a real app, this would come from your backend/LangChain
interface File {
	path: string;
	documentation: string;
}

interface Documentation {
	overview: string;
	files: File[];
}

const DocumentationView = () => {
	const { repoId } = useParams<{ repoId: string }>();
	const [documentation, setDocumentation] = useState<Documentation | null>(
		null
	);
	const [loading, setLoading] = useState(true);
	const [selectedFile, setSelectedFile] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const navigate = useNavigate();

	useEffect(() => {
		const fetchDocumentation = async () => {
			if (!repoId) return;

			try {
				setLoading(true);
				const repoUrl = decodeURIComponent(repoId);

				// In a real app, this would be an actual API call to your backend
				// For demo purposes, we'll simulate the API call with mock data
				await new Promise((resolve) => setTimeout(resolve, 1500));

				const mockDocumentation: Documentation = {
					overview: `This repository contains a web application built with React and TypeScript. 
                     It demonstrates modern frontend development practices including component 
                     composition, state management, and responsive design.`,
					files: [
						{
							path: "src/App.tsx",
							documentation: `# App Component\n\nThe main application component that handles routing and global state.\n\n## Key Functions\n\n- **useEffect hook**: Initializes the application and loads user preferences\n- **ThemeProvider**: Provides theme context to all child components\n- **Router**: Configures application routes using React Router\n\n## Usage\nThis component is the entry point of the application and shouldn't be used directly elsewhere.`,
						},
						{
							path: "src/components/Header.tsx",
							documentation: `# Header Component\n\nA responsive header component that displays the application logo, navigation links, and user profile.\n\n## Props\n\n- **title**: string - The title to display\n- **user**: User | null - The current user object\n- **onLogout**: () => void - Callback for logout action\n\n## Implementation Details\n\nUses CSS Flexbox for layout and includes mobile responsive design with a hamburger menu for small screens.`,
						},
						{
							path: "src/utils/api.ts",
							documentation: `# API Utilities\n\nContains functions for interacting with the backend API.\n\n## Functions\n\n- **fetchData(url, options)**: Fetches data from the API with error handling\n- **postData(url, data, options)**: Sends data to the API\n- **handleApiError(error)**: Processes API errors for consistent handling\n\n## Error Handling\n\nAll functions implement retry logic with exponential backoff for transient failures.`,
						},
					],
				};

				setDocumentation(mockDocumentation);
				if (mockDocumentation.files.length > 0) {
					setSelectedFile(mockDocumentation.files[0].path);
				}
			} catch (err) {
				console.error("Error fetching documentation:", err);
				setError("Failed to load documentation. Please try again.");
			} finally {
				setLoading(false);
			}
		};

		fetchDocumentation();
	}, [repoId]);

	const getSelectedFileDocumentation = () => {
		if (!documentation || !selectedFile) return null;

		const file = documentation.files.find((f) => f.path === selectedFile);
		return file ? file.documentation : null;
	};

	const handleBackClick = () => {
		navigate("/");
	};

	if (loading) {
		return (
			<div className="loading-container">
				<div className="loading-indicator">
					<div className="loading-spinner"></div>
					<p>Generating documentation...</p>
				</div>
			</div>
		);
	}

	if (error || !documentation) {
		return (
			<div className="error-container">
				<h2>Error</h2>
				<p>{error || "Failed to load documentation"}</p>
				<button onClick={handleBackClick} className="back-button">
					Back to Dashboard
				</button>
			</div>
		);
	}

	return (
		<div className="documentation-container">
			<header className="documentation-header">
				<button onClick={handleBackClick} className="back-button">
					← Back
				</button>
				<h1>Repository: {decodeURIComponent(repoId || "")}</h1>
			</header>

			<div className="documentation-layout">
				<aside className="documentation-sidebar">
					<div className="sidebar-section">
						<h3>Overview</h3>
						<button
							className={`sidebar-item ${
								!selectedFile ? "active" : ""
							}`}
							onClick={() => setSelectedFile(null)}
						>
							Repository Summary
						</button>
					</div>

					<div className="sidebar-section">
						<h3>Files</h3>
						<div className="file-list">
							{documentation.files.map((file, index) => (
								<button
									key={index}
									className={`sidebar-item ${
										selectedFile === file.path
											? "active"
											: ""
									}`}
									onClick={() => setSelectedFile(file.path)}
								>
									{file.path}
								</button>
							))}
						</div>
					</div>
				</aside>

				<main className="documentation-content">
					{!selectedFile ? (
						<div className="overview-section">
							<h2>Repository Overview</h2>
							<p>{documentation.overview}</p>
						</div>
					) : (
						<div className="file-documentation">
							<h2>{selectedFile}</h2>
							<div className="markdown-content">
								{getSelectedFileDocumentation()}
							</div>
						</div>
					)}
				</main>
			</div>
		</div>
	);
};

export default DocumentationView;
