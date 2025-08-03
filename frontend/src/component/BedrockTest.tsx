import { useState } from "react";
import ApiService from "../services/apiService";

const BedrockTest = () => {
	const [isLoading, setIsLoading] = useState(false);
	const [response, setResponse] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	const testConnection = async () => {
		setIsLoading(true);
		setResponse(null);
		setError(null);

		try {
			const message = await ApiService.testBedrockConnection();
			setResponse(message);
		} catch (err) {
			setError(
				err instanceof Error
					? err.message
					: "Failed to connect to Bedrock"
			);
			console.error(err);
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<div className="bedrock-test">
			<h3>Test AWS Bedrock Connection</h3>
			<button
				onClick={testConnection}
				disabled={isLoading}
				className="test-button"
			>
				{isLoading ? "Testing..." : "Test Connection"}
			</button>

			{response && <div className="success-message">{response}</div>}
			{error && <div className="error-message">{error}</div>}
		</div>
	);
};

export default BedrockTest;
