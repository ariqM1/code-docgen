/**
 * Service for managing conversation sessions and context
 */
class ConversationService {
	constructor() {
		// In-memory storage for conversations (consider using Redis/DB for production)
		this.conversations = new Map();
		this.maxConversationLength = 20;
		this.contextWindow = 6; // Number of recent messages to include
	}

	/**
	 * Create a new conversation session
	 */
	createConversation(repositoryId, repositoryInfo) {
		const conversationId = this.generateConversationId();
		const conversation = {
			id: conversationId,
			repositoryId,
			repositoryInfo,
			messages: [],
			createdAt: new Date(),
			lastActivity: new Date(),
		};

		this.conversations.set(conversationId, conversation);
		return conversationId;
	}

	/**
	 * Add a message to the conversation
	 */
	addMessage(conversationId, role, content, metadata = {}) {
		const conversation = this.conversations.get(conversationId);
		if (!conversation) {
			throw new Error("Conversation not found");
		}

		const message = {
			id: this.generateMessageId(),
			role, // 'user' or 'assistant'
			content,
			timestamp: new Date(),
			metadata,
		};

		conversation.messages.push(message);
		conversation.lastActivity = new Date();

		// Trim conversation if it gets too long
		if (conversation.messages.length > this.maxConversationLength) {
			conversation.messages = conversation.messages.slice(-this.maxConversationLength);
		}

		return message;
	}

	/**
	 * Get conversation history
	 */
	getConversation(conversationId) {
		return this.conversations.get(conversationId);
	}

	/**
	 * Get recent messages for context
	 */
	getRecentMessages(conversationId, count = this.contextWindow) {
		const conversation = this.conversations.get(conversationId);
		if (!conversation) {
			return [];
		}

		return conversation.messages.slice(-count);
	}

	/**
	 * Get all active conversations for a repository
	 */
	getRepositoryConversations(repositoryId) {
		return Array.from(this.conversations.values())
			.filter(conv => conv.repositoryId === repositoryId)
			.sort((a, b) => b.lastActivity - a.lastActivity);
	}

	/**
	 * Delete a conversation
	 */
	deleteConversation(conversationId) {
		return this.conversations.delete(conversationId);
	}

	/**
	 * Clean up old conversations (older than 24 hours)
	 */
	cleanupOldConversations() {
		const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
		
		for (const [id, conversation] of this.conversations.entries()) {
			if (conversation.lastActivity < cutoff) {
				this.conversations.delete(id);
			}
		}
	}

	/**
	 * Generate unique conversation ID
	 */
	generateConversationId() {
		return `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
	}

	/**
	 * Generate unique message ID
	 */
	generateMessageId() {
		return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
	}

	/**
	 * Get conversation statistics
	 */
	getStats() {
		const totalConversations = this.conversations.size;
		const activeConversations = Array.from(this.conversations.values())
			.filter(conv => {
				const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
				return conv.lastActivity > hourAgo;
			}).length;

		return {
			totalConversations,
			activeConversations,
			totalMessages: Array.from(this.conversations.values())
				.reduce((sum, conv) => sum + conv.messages.length, 0),
		};
	}
}

export default ConversationService;