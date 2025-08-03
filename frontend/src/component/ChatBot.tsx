import {
	Box,
	Flex,
	HStack,
	IconButton,
	Text,
	VStack,
	useDisclosure,
} from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { BsChatSquareText, BsX } from "react-icons/bs";
import type { ChatMessage, Documentation, Repository } from "../types";
import ChatWindow from "./ChatWindow";

interface ChatBotProps {
	repository: Repository | null;
	documentation: Documentation | null;
}

const ChatBot: React.FC<ChatBotProps> = ({ repository, documentation }) => {
	const { open: isOpen, onOpen, onClose } = useDisclosure();
	const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
	const [isChatLoading, setIsChatLoading] = useState<boolean>(false);

	// Get conversation key for storage
	const getConversationKey = () => {
		if (!repository) return null;
		return `chat_${repository.owner}_${repository.name}`;
	};

	// Load chat history from localStorage
	useEffect(() => {
		const conversationKey = getConversationKey();
		if (conversationKey && repository && documentation) {
			const savedMessages = localStorage.getItem(conversationKey);
			if (savedMessages) {
				try {
					const parsed = JSON.parse(savedMessages);
					// Convert timestamp strings back to Date objects
					const messagesWithDates = parsed.map((msg: any) => ({
						...msg,
						timestamp: new Date(msg.timestamp),
					}));
					setChatMessages(messagesWithDates);
					return; // Don't add welcome message if we have saved messages
				} catch (error) {
					console.error("Error loading chat history:", error);
				}
			}

			// Add welcome message if no saved messages
			const welcomeMessage: ChatMessage = {
				id: "welcome",
				role: "assistant",
				content: `Hi! I've analyzed **${repository.owner}/${repository.name}**. Ask me about code structure, functions, dependencies, or debugging. Try: "What does this repository do?"`,
				timestamp: new Date(),
			};
			setChatMessages([welcomeMessage]);
		}
	}, [repository, documentation]);

	// Save chat messages to localStorage whenever they change
	useEffect(() => {
		const conversationKey = getConversationKey();
		if (conversationKey && chatMessages.length > 0) {
			localStorage.setItem(conversationKey, JSON.stringify(chatMessages));
		}
	}, [chatMessages, repository]);

	const sendMessage = async (message: string): Promise<void> => {
		if (!repository || !documentation) return;

		const userMessage: ChatMessage = {
			id: Date.now().toString(),
			role: "user",
			content: message,
			timestamp: new Date(),
		};

		setChatMessages((prev) => [...prev, userMessage]);
		setIsChatLoading(true);

		try {
			const API_URL =
				process.env.REACT_APP_API_URL || "http://localhost:4000/api";

			const response = await fetch(`${API_URL}/chat-about-repository`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					message,
					repository: {
						owner: repository.owner,
						name: repository.name,
					},
					documentation: documentation.json,
					conversationHistory: chatMessages.slice(-10), // Last 10 messages for context
				}),
			});

			const data = await response.json();

			if (data.success) {
				const assistantMessage: ChatMessage = {
					id: (Date.now() + 1).toString(),
					role: "assistant",
					content: data.reply,
					timestamp: new Date(),
				};
				setChatMessages((prev) => [...prev, assistantMessage]);
			} else {
				throw new Error(data.error || "Failed to get response");
			}
		} catch (error) {
			console.error("Error sending chat message:", error);
			const errorMessage: ChatMessage = {
				id: (Date.now() + 1).toString(),
				role: "assistant",
				content:
					"Sorry, I encountered an error processing your request. Please try again.",
				timestamp: new Date(),
			};
			setChatMessages((prev) => [...prev, errorMessage]);
		} finally {
			setIsChatLoading(false);
		}
	};

	const clearChat = () => {
		const conversationKey = getConversationKey();
		if (conversationKey) {
			localStorage.removeItem(conversationKey);
		}

		// Add welcome message back after clearing
		if (repository && documentation) {
			const welcomeMessage: ChatMessage = {
				id: "welcome",
				role: "assistant",
				content: `Hi! I've analyzed **${repository.owner}/${repository.name}**. Ask me about code structure, functions, dependencies, or debugging. Try: "What does this repository do?"`,
				timestamp: new Date(),
			};
			setChatMessages([welcomeMessage]);
		} else {
			setChatMessages([]);
		}
	};

	// Don't show chat if no documentation
	if (!documentation || !repository) {
		return null;
	}

	return (
		<>
			{/* Chat Toggle Button */}
			<Box position="fixed" bottom={6} right={6} zIndex="overlay">
				<IconButton
					aria-label="Open repository assistant"
					colorScheme="blue"
					size="lg"
					borderRadius="full"
					boxShadow="lg"
					onClick={onOpen}
					_hover={{ transform: "scale(1.05)" }}
					transition="transform 0.2s"
				>
					<BsChatSquareText />
				</IconButton>
			</Box>

			{/* Chat Modal */}
			{isOpen && (
				<Box
					position="fixed"
					top="0"
					left="0"
					right="0"
					bottom="0"
					bg="blackAlpha.600"
					display="flex"
					alignItems="center"
					justifyContent="center"
					zIndex="modal"
					onClick={onClose}
				>
					<Box
						bg="white"
						borderRadius="xl"
						boxShadow="2xl"
						maxW="700px"
						w="full"
						h="85vh"
						m={4}
						display="flex"
						flexDirection="column"
						onClick={(e) => e.stopPropagation()}
						overflow="hidden"
					>
						{/* Chat Header */}
						<Box
							p={4}
							borderBottomWidth="1px"
							bg="blue.50"
							borderTopRadius="xl"
						>
							<Flex align="center" justify="space-between">
								<HStack spacing={3}>
									<Box
										w={10}
										h={10}
										bg="blue.500"
										borderRadius="full"
										display="flex"
										alignItems="center"
										justifyContent="center"
										fontSize="lg"
									>
										🤖
									</Box>
									<VStack align="start" spacing={0}>
										<Text fontWeight="bold" fontSize="lg">
											Repository Assistant
										</Text>
										<Text fontSize="sm" color="gray.600">
											{repository.owner}/{repository.name}
										</Text>
									</VStack>
								</HStack>
								<IconButton
									aria-label="Close chat"
									size="md"
									variant="ghost"
									onClick={onClose}
								>
									<BsX />
								</IconButton>
							</Flex>
						</Box>

						{/* Chat Window */}
						<ChatWindow
							messages={chatMessages}
							isLoading={isChatLoading}
							onSendMessage={sendMessage}
							onClearChat={clearChat}
							repository={repository}
						/>
					</Box>
				</Box>
			)}
		</>
	);
};

export default ChatBot;
