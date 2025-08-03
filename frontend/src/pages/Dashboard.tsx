import {
	Badge,
	Box,
	Button,
	Container,
	Flex,
	Heading,
	HStack,
	Input,
	Text,
	VStack,
} from "@chakra-ui/react";
import axios, { AxiosError } from "axios";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import ChatBot from "../component/ChatBot";
import type { 
	Repository, 
	Documentation, 
	DocumentationFile, 
	FileNode, 
	ViewMode,
	ApiErrorResponse 
} from "../types";
import "./Dashboard.css";


const Dashboard = () => {
	// State for repository connection
	const [repoUrl, setRepoUrl] = useState<string>("");
	const [isLoading, setIsLoading] = useState<boolean>(false);
	const [error, setError] = useState<string | null>(null);
	const [repository, setRepository] = useState<Repository | null>(null);
	const [isGeneratingDoc, setIsGeneratingDoc] = useState<boolean>(false);

	// Documentation state
	const [documentation, setDocumentation] = useState<Documentation | null>(
		null
	);
	const [selectedFilePath, setSelectedFilePath] = useState<string | null>(
		null
	);
	const [viewMode, setViewMode] = useState<ViewMode>("summary");

	// Background colors
	const bgColor = "gray.50";

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

				// Store repository in session storage for backup
				sessionStorage.setItem("repository", JSON.stringify(repo));
			} else {
				throw new Error(
					response.data.error || "Failed to connect to repository"
				);
			}
		} catch (error) {
			console.error("Error connecting to repository:", error);
			const axiosError = error as AxiosError<ApiErrorResponse>;
			setError(
				axiosError.response?.data?.error ||
					(error as Error).message ||
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
				setViewMode("summary"); // Default to summary view

				// Save documentation to session storage
				sessionStorage.setItem(
					`documentation_${repository.owner}_${repository.name}`,
					JSON.stringify(response.data.documentation)
				);
			} else {
				throw new Error(
					response.data.error || "Failed to generate documentation"
				);
			}
		} catch (error) {
			console.error("Error generating documentation:", error);
			const axiosError = error as AxiosError<ApiErrorResponse>;
			setError(
				axiosError.response?.data?.error ||
					(error as Error).message ||
					"Failed to generate documentation"
			);
		} finally {
			setIsGeneratingDoc(false);
		}
	};


	// Reset connection to try another repository
	const resetConnection = () => {
		setRepository(null);
		setDocumentation(null);
		setSelectedFilePath(null);
		setRepoUrl("");
		// Clear from session storage
		sessionStorage.removeItem("repository");
		if (repository) {
			sessionStorage.removeItem(
				`documentation_${repository.owner}_${repository.name}`
			);
		}
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

	// Render file tree recursively
	const renderFileTree = (nodes: FileNode[] | undefined) => {
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
									{renderFileTree(node.children)}
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

	return (
		<Box bg={bgColor} minH="100vh" py={10}>
			<Container maxW="container.xl">
				<VStack spacing={8} align="stretch">
					<Box textAlign="center">
						<Heading as="h1" size="xl" mb={4}>
							AI Code Documentation Generator
						</Heading>
						<Text fontSize="lg" color="gray.600">
							Generate comprehensive documentation for your GitHub
							repositories using AI. Our tool analyzes your code
							and creates detailed documentation with
							explanations, usage examples, and more.
						</Text>
					</Box>

					{/* Repository Connection Section */}
					{!repository ? (
						<Box bg="white" p={6} borderRadius="md" boxShadow="md">
							<Heading as="h2" size="md" mb={4}>
								Connect to GitHub Repository
							</Heading>
							<form onSubmit={connectToRepository}>
								<VStack spacing={4} align="stretch">
									<Input
										value={repoUrl}
										onChange={(e) =>
											setRepoUrl(e.target.value)
										}
										placeholder="https://github.com/username/repository"
										disabled={isLoading}
										size="lg"
									/>
									<Button
										type="submit"
										colorScheme="blue"
										size="lg"
										loading={isLoading}
										loadingText="Connecting..."
									>
										Connect Repository
									</Button>
								</VStack>

								{error && (
									<Box
										mt={4}
										p={3}
										borderRadius="md"
										bg="red.100"
										color="red.800"
									>
										{error}
									</Box>
								)}
							</form>
						</Box>
					) : (
						/* Repository Info & Documentation Generation */
						<Box bg="white" p={6} borderRadius="md" boxShadow="md">
							<Heading as="h2" size="md" mb={4}>
								Repository Connected
							</Heading>
							<VStack spacing={3} align="flex-start" mb={6}>
								<HStack>
									<Text fontWeight="bold" minW="120px">
										Name:
									</Text>
									<Text>
										{repository.owner}/{repository.name}
									</Text>
								</HStack>
								<HStack>
									<Text fontWeight="bold" minW="120px">
										Description:
									</Text>
									<Text>
										{repository.description ||
											"No description provided"}
									</Text>
								</HStack>
								<HStack>
									<Text fontWeight="bold" minW="120px">
										Default Branch:
									</Text>
									<Text>{repository.defaultBranch}</Text>
								</HStack>
								<HStack>
									<Text fontWeight="bold" minW="120px">
										Files:
									</Text>
									<Text>
										{countFiles(repository.fileStructure)}{" "}
										files found
									</Text>
								</HStack>
							</VStack>

							<Box borderTopWidth="1px" my={4} />

							{!documentation ? (
								<VStack spacing={4}>
									<Button
										colorScheme="blue"
										size="lg"
										onClick={generateDocumentation}
										loading={isGeneratingDoc}
										loadingText="Generating Documentation..."
									>
										Generate Documentation
									</Button>

									<Button
										variant="outline"
										size="lg"
										onClick={resetConnection}
										disabled={isLoading || isGeneratingDoc}
									>
										Connect Different Repository
									</Button>
								</VStack>
							) : (
								<Flex gap={4} align="center">
									<Button
										variant="outline"
										size="lg"
										onClick={resetConnection}
									>
										Connect Different Repository
									</Button>
									<Badge
										colorScheme="green"
										size="lg"
										borderRadius="md"
										px={3}
										py={1}
									>
										Documentation Ready
									</Badge>
								</Flex>
							)}
						</Box>
					)}

					{/* Documentation Display Section */}
					{documentation && (
						<Box
							bg="white"
							borderRadius="md"
							boxShadow="md"
							overflow="hidden"
						>
							<Box p={6} borderBottomWidth="1px">
								<Heading as="h2" size="md">
									Documentation: {repository?.owner}/
									{repository?.name}
								</Heading>
							</Box>

							<Flex
								direction={{ base: "column", lg: "row" }}
								minH="600px"
							>
								{/* Sidebar */}
								<Box
									w={{ base: "100%", lg: "300px" }}
									borderRightWidth={{ lg: "1px" }}
									bg="gray.50"
								>
									<VStack p={4} spacing={4} align="stretch">
										{/* View Options */}
										<Box>
											<Text fontWeight="bold" mb={2}>
												Views
											</Text>
											<VStack spacing={2}>
												<Button
													variant={
														viewMode === "summary"
															? "solid"
															: "ghost"
													}
													size="sm"
													width="full"
													justifyContent="flex-start"
													onClick={() =>
														setViewMode("summary")
													}
												>
													Repository Overview
												</Button>
												<Button
													variant={
														viewMode ===
														"fullMarkdown"
															? "solid"
															: "ghost"
													}
													size="sm"
													width="full"
													justifyContent="flex-start"
													onClick={() =>
														setViewMode(
															"fullMarkdown"
														)
													}
												>
													Full Documentation
												</Button>
											</VStack>
										</Box>

										{/* File Explorer */}
										<Box>
											<Text fontWeight="bold" mb={2}>
												Files
											</Text>
											<Box className="file-explorer">
												{renderFileTree(
													repository?.fileStructure
												)}
											</Box>
										</Box>
									</VStack>
								</Box>

								{/* Main Content */}
								<Box flex="1" p={6} overflow="auto">
									{viewMode === "summary" &&
										renderRepositorySummary()}
									{viewMode === "file" &&
										renderFileDocumentation()}
									{viewMode === "fullMarkdown" && (
										<div className="full-markdown">
											<ReactMarkdown>
												{documentation.markdown}
											</ReactMarkdown>
										</div>
									)}
								</Box>
							</Flex>
						</Box>
					)}

					{/* Features Section */}
					{!documentation && (
						<Box bg="white" p={6} borderRadius="md" boxShadow="md">
							<Heading as="h2" size="md" mb={4}>
								Features
							</Heading>
							<Box as="ul" pl={5}>
								<Box as="li" mb={2}>
									Detailed function and class documentation
								</Box>
								<Box as="li" mb={2}>
									Interactive code exploration
								</Box>
								<Box as="li" mb={2}>
									Support for multiple programming languages
								</Box>
								<Box as="li" mb={2}>
									Ask questions about your code
								</Box>
							</Box>
						</Box>
					)}
				</VStack>
			</Container>

			{/* Chat Bot Component */}
			<ChatBot repository={repository} documentation={documentation} />
		</Box>
	);
};

export default Dashboard;
