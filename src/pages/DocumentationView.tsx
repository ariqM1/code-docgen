import axios from "axios";
import React, { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import { useNavigate, useParams } from "react-router-dom";
import "./DocumentationView.css";

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

interface DocumentationFile {
	overview: string;
	purpose: string;
	dependencies: string[];
	components: {
		name: string;
		type: string;
		description: string;
		params?: { name: string; type: string; description: string }[];
		returns?: { type: string; description: string };
		examples?: string[];
	}[];
	notes?: string;
	metadata: {
		filePath: string;
		fileType: string;
		generatedAt: string;
		repositoryInfo: {
			owner: string;
			name: string;
			branch: string;
		};
	};
	error?: string;
}

interface RepositorySummary {
	summary: string;
	mainComponents?: string[];
	architecture?: string;
	technologies?: string[];
	useCases?: string[];
}

interface Documentation {
	json: {
		repository: {
			owner: string;
			name: string;
			description: string;
			defaultBranch: string;
		};
		generated: string;
		files: Record<string, DocumentationFile>;
		summary: RepositorySummary | null;
	};
	markdown: string;
}

const DocumentationView: React.FC = () => {
	const [repository, setRepository] = useState<Repository | null>(null);
	const [documentation, setDocumentation] = useState<Documentation | null>(
		null
	);
	const [isGenerating, setIsGenerating] = useState<boolean>(false);
	const [error, setError] = useState<string | null>(null);
	const [selectedFilePath, setSelectedFilePath] = useState<string | null>(
		null
	);
	const [viewMode, setViewMode] = useState<
		"summary" | "file" | "fullMarkdown"
	>("summary");

	const navigate = useNavigate();

	// API client configuration
	const API_URL =
		process.env.REACT_APP_API_URL || "http://localhost:4000/api";

	// When the component loads, check if we have a repository in session storage
	useEffect(() => {
		const savedRepo = sessionStorage.getItem("repository");
		if (savedRepo) {
			try {
				setRepository(JSON.parse(savedRepo));
			} catch (err) {
				console.error("Error parsing saved repository:", err);
			}
		}
	}, []);

	// Generate documentation for the repository
	const generateDocumentation = async () => {
		if (!repository) return;

		try {
			setIsGenerating(true);
			setError(null);

			// Call the backend API to generate documentation
			const response = await axios.post(
				`${API_URL}/generate-documentation`,
				{
					owner: repository.owner,
					repo: repository.name,
					branch: repository.defaultBranch,
					fileStructure: repository.fileStructure,
				}
			);

			if (response.data.success) {
				setDocumentation(response.data.documentation);

				// Save documentation to session storage to avoid regenerating
				sessionStorage.setItem(
					`documentation_${repository.owner}_${repository.name}`,
					JSON.stringify(response.data.documentation)
				);
			} else {
				throw new Error(
					response.data.error || "Failed to generate documentation"
				);
			}
		} catch (error: any) {
			console.error("Error generating documentation:", error);
			setError(
				error.response?.data?.error ||
					error.message ||
					"Failed to generate documentation"
			);
		} finally {
			setIsGenerating(false);
		}
	};

	// Render file tree recursively
	const renderFileTree = (
		nodes: FileNode[] | undefined,
		basePath: string = ""
	) => {
		if (!nodes || !Array.isArray(nodes)) return null;

		return (
			<ul className="file-tree">
				{nodes
					.sort((a, b) => {
						// Directories first, then alphabetical
						if (a.type === "directory" && b.type === "file")
							return -1;
						if (a.type === "file" && b.type === "directory")
							return 1;
						return a.path.localeCompare(b.path);
					})
					.map((node, index) => {
						const fullPath = node.path;

						if (node.type === "directory") {
							return (
								<li key={index} className="directory-item">
									<div className="directory-name">
										<span className="icon">📁</span>
										{node.path.split("/").pop()}
									</div>
									{renderFileTree(node.children, fullPath)}
								</li>
							);
						} else {
							// Check if we have documentation for this file
							const hasDocumentation =
								documentation &&
								documentation.json &&
								documentation.json.files &&
								documentation.json.files[fullPath];

							// Only show files with documentation
							if (!hasDocumentation) return null;

							return (
								<li key={index} className="file-item">
									<button
										className={`file-button ${
											fullPath === selectedFilePath
												? "selected"
												: ""
										}`}
										onClick={() => {
											setSelectedFilePath(fullPath);
											setViewMode("file");
										}}
									>
										<span className="icon">📄</span>
										{node.path.split("/").pop()}
									</button>
								</li>
							);
						}
					})}
			</ul>
		);
	};

	// Render documentation for the selected file
	const renderFileDocumentation = () => {
		if (!documentation || !selectedFilePath) return null;

		const fileDoc = documentation.json.files[selectedFilePath];
		if (!fileDoc)
			return <div>No documentation available for this file.</div>;

		return (
			<div className="file-documentation">
				<h2 className="file-path">{selectedFilePath}</h2>

				{fileDoc.error ? (
					<div className="error-message">{fileDoc.error}</div>
				) : (
					<>
						<section className="doc-section">
							<h3>Overview</h3>
							<p>{fileDoc.overview}</p>
						</section>

						{fileDoc.purpose && (
							<section className="doc-section">
								<h3>Purpose</h3>
								<p>{fileDoc.purpose}</p>
							</section>
						)}

						{fileDoc.dependencies &&
							fileDoc.dependencies.length > 0 && (
								<section className="doc-section">
									<h3>Dependencies</h3>
									<ul>
										{fileDoc.dependencies.map(
											(dep, index) => (
												<li key={index}>{dep}</li>
											)
										)}
									</ul>
								</section>
							)}

						{fileDoc.components &&
							fileDoc.components.length > 0 && (
								<section className="doc-section">
									<h3>Components</h3>
									{fileDoc.components.map(
										(component, index) => (
											<div
												key={index}
												className="component-doc"
											>
												<h4>
													{component.name}{" "}
													<span className="component-type">
														({component.type})
													</span>
												</h4>
												<p>{component.description}</p>

												{component.params &&
													component.params.length >
														0 && (
														<div className="params">
															<h5>Parameters</h5>
															<ul>
																{component.params.map(
																	(
																		param,
																		pIndex
																	) => (
																		<li
																			key={
																				pIndex
																			}
																		>
																			<code>
																				{
																					param.name
																				}
																			</code>{" "}
																			<span className="param-type">
																				(
																				{
																					param.type
																				}

																				)
																			</span>
																			:{" "}
																			{
																				param.description
																			}
																		</li>
																	)
																)}
															</ul>
														</div>
													)}

												{component.returns && (
													<div className="returns">
														<h5>Returns</h5>
														<p>
															<span className="return-type">
																(
																{
																	component
																		.returns
																		.type
																}
																)
															</span>
															:{" "}
															{
																component
																	.returns
																	.description
															}
														</p>
													</div>
												)}

												{component.examples &&
													component.examples.length >
														0 && (
														<div className="examples">
															<h5>Examples</h5>
															{component.examples.map(
																(
																	example,
																	eIndex
																) => (
																	<pre
																		key={
																			eIndex
																		}
																		className="code-example"
																	>
																		<code>
																			{
																				example
																			}
																		</code>
																	</pre>
																)
															)}
														</div>
													)}
											</div>
										)
									)}
								</section>
							)}

						{fileDoc.notes && (
							<section className="doc-section">
								<h3>Notes</h3>
								<p>{fileDoc.notes}</p>
							</section>
						)}

						<div className="file-metadata">
							<p>
								Generated on:{" "}
								{new Date(
									fileDoc.metadata.generatedAt
								).toLocaleString()}
							</p>
						</div>
					</>
				)}
			</div>
		);
	};

	// Render repository summary
	const renderRepositorySummary = () => {
		if (!documentation || !documentation.json.summary) {
			return <div>No repository summary available.</div>;
		}

		const summary = documentation.json.summary;

		return (
			<div className="repository-summary">
				<h2>Repository Overview</h2>

				<section className="doc-section">
					<h3>Summary</h3>
					<p>{summary.summary}</p>
				</section>

				{summary.mainComponents &&
					summary.mainComponents.length > 0 && (
						<section className="doc-section">
							<h3>Main Components</h3>
							<ul>
								{summary.mainComponents.map(
									(component, index) => (
										<li key={index}>{component}</li>
									)
								)}
							</ul>
						</section>
					)}

				{summary.architecture && (
					<section className="doc-section">
						<h3>Architecture</h3>
						<p>{summary.architecture}</p>
					</section>
				)}

				{summary.technologies && summary.technologies.length > 0 && (
					<section className="doc-section">
						<h3>Technologies</h3>
						<ul>
							{summary.technologies.map((tech, index) => (
								<li key={index}>{tech}</li>
							))}
						</ul>
					</section>
				)}

				{summary.useCases && summary.useCases.length > 0 && (
					<section className="doc-section">
						<h3>Use Cases</h3>
						<ul>
							{summary.useCases.map((useCase, index) => (
								<li key={index}>{useCase}</li>
							))}
						</ul>
					</section>
				)}
			</div>
		);
	};

	// Go back to dashboard
	const goToDashboard = () => {
		navigate("/");
	};

	// If no repository is set, redirect to dashboard
	if (!repository) {
		return (
			<div className="documentation-view">
				<div className="no-repository">
					<h2>No Repository Selected</h2>
					<p>Please connect to a repository first.</p>
					<button className="button-primary" onClick={goToDashboard}>
						Go to Dashboard
					</button>
				</div>
			</div>
		);
	}

	return (
		<div className="documentation-view">
			<div className="documentation-header">
				<h1>
					Documentation: {repository.owner}/{repository.name}
				</h1>
				<div className="header-actions">
					<button
						className="button-secondary"
						onClick={goToDashboard}
					>
						Back to Dashboard
					</button>
				</div>
			</div>

			{!documentation ? (
				<div className="documentation-actions">
					<p>
						Generate comprehensive documentation for this repository
						using AWS Bedrock's Claude.
					</p>
					<button
						className="button-primary"
						onClick={generateDocumentation}
						disabled={isGenerating}
					>
						{isGenerating ? (
							<>
								<span className="loading-spinner"></span>
								Generating Documentation...
							</>
						) : (
							"Generate Documentation"
						)}
					</button>
					{error && <div className="error-message">{error}</div>}
				</div>
			) : (
				<div className="documentation-content">
					<div className="doc-sidebar">
						<div className="view-options">
							<button
								className={`view-button ${
									viewMode === "summary" ? "active" : ""
								}`}
								onClick={() => setViewMode("summary")}
							>
								Repository Overview
							</button>
							<button
								className={`view-button ${
									viewMode === "fullMarkdown" ? "active" : ""
								}`}
								onClick={() => setViewMode("fullMarkdown")}
							>
								Full Documentation
							</button>
						</div>

						<div className="file-explorer">
							<h3>Files</h3>
							{renderFileTree(repository.fileStructure)}
						</div>
					</div>

					<div className="doc-main">
						{viewMode === "summary" && renderRepositorySummary()}
						{viewMode === "file" && renderFileDocumentation()}
						{viewMode === "fullMarkdown" && (
							<div className="full-markdown">
								<ReactMarkdown>
									{documentation.markdown}
								</ReactMarkdown>
							</div>
						)}
					</div>
				</div>
			)}
		</div>
	);
};

export default DocumentationView;
