import axios from "axios";

class GitHubService {
	constructor(token) {
		this.api = axios.create({
			baseURL: "https://api.github.com",
			headers: token ? { Authorization: `token ${token}` } : {},
		});
	}

	parseGitHubUrl(url) {
		try {
			const urlObj = new URL(url);
			if (!urlObj.hostname.includes("github.com")) {
				return null;
			}

			const pathParts = urlObj.pathname.split("/").filter(Boolean);
			if (pathParts.length < 2) {
				return null;
			}

			return {
				owner: pathParts[0],
				repo: pathParts[1],
			};
		} catch (error) {
			console.error("Error parsing GitHub URL:", error);
			return null;
		}
	}

	async getRepositoryInfo(owner, repo) {
		try {
			const response = await this.api.get(`/repos/${owner}/${repo}`);
			return response.data;
		} catch (error) {
			console.error(`Error fetching repository info for ${owner}/${repo}:`, error);
			throw new Error("Failed to fetch repository information");
		}
	}

	async getFileStructure(owner, repo, path = "", branch = "main") {
		try {
			const response = await this.api.get(
				`/repos/${owner}/${repo}/contents/${path}`,
				{ params: { ref: branch } }
			);

			const fileStructure = [];

			for (const item of response.data) {
				const node = {
					path: item.path,
					type: item.type === "dir" ? "directory" : "file",
				};

				if (item.type === "dir") {
					node.children = await this.getFileStructure(owner, repo, item.path, branch);
				}

				fileStructure.push(node);
			}

			return fileStructure;
		} catch (error) {
			console.error(`Error fetching file structure for ${path}:`, error);
			return [];
		}
	}

	async fetchFileContent(owner, repo, filePath, branch) {
		try {
			const response = await this.api.get(
				`/repos/${owner}/${repo}/contents/${filePath}`,
				{ params: { ref: branch } }
			);

			const content = Buffer.from(response.data.content, "base64").toString();
			return content;
		} catch (error) {
			console.error(`Error fetching file content for ${filePath}:`, error);
			return null;
		}
	}
}

export default GitHubService;