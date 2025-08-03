// Core repository types
export interface FileNode {
	path: string;
	type: "file" | "directory";
	children?: FileNode[];
}

export interface Repository {
	owner: string;
	name: string;
	url: string;
	description: string | null;
	defaultBranch: string;
	fileStructure: FileNode[];
}

// Documentation types
export interface ComponentParam {
	name: string;
	type: string;
	description: string;
}

export interface ComponentReturn {
	type: string;
	description: string;
}

export interface DocumentationComponent {
	name: string;
	type: string;
	description: string;
	params?: ComponentParam[];
	returns?: ComponentReturn;
	examples?: string[];
}

export interface DocumentationFile {
	overview: string;
	purpose: string;
	dependencies: string[];
	components: DocumentationComponent[];
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
		mockGenerated?: boolean;
	};
	error?: string;
}

export interface RepositorySummary {
	summary: string;
	mainComponents?: string[];
	architecture?: string;
	technologies?: string[];
	useCases?: string[];
}

export interface DocumentationData {
	repository: {
		owner: string;
		name: string;
		description: string;
		defaultBranch: string;
	};
	generated: string;
	files: Record<string, DocumentationFile>;
	summary: RepositorySummary | null;
}

export interface Documentation {
	json: DocumentationData;
	markdown: string;
}

// Chat types
export interface ChatMessage {
	id: string;
	role: "user" | "assistant";
	content: string;
	timestamp: Date;
}

export interface ConversationHistoryItem {
	role: "user" | "assistant";
	content: string;
}

// API response types
export interface ApiErrorResponse {
	success: false;
	error: string;
}

export interface ApiSuccessResponse<T> {
	success: true;
	data?: T;
}

export interface ConnectRepositoryResponse {
	success: boolean;
	repository?: Repository;
	error?: string;
}

export interface GenerateDocumentationResponse {
	success: boolean;
	documentation?: Documentation;
	error?: string;
}

export interface ChatResponse {
	success: boolean;
	reply?: string;
	error?: string;
}

// UI state types
export type ViewMode = "summary" | "file" | "fullMarkdown";

export interface AppState {
	repository: Repository | null;
	documentation: Documentation | null;
	selectedFilePath: string | null;
	viewMode: ViewMode;
	isLoading: boolean;
	isGeneratingDoc: boolean;
	error: string | null;
}