import {
	Box,
	Button,
	Flex,
	HStack,
	IconButton,
	Input,
	Spinner,
	Text,
	VStack,
	Wrap,
	WrapItem,
} from "@chakra-ui/react";
import { useEffect, useRef, useState } from "react";
import { BsArrowUp, BsTrash } from "react-icons/bs";
import ReactMarkdown from "react-markdown";
import type { ChatMessage, Repository } from "../types";

interface ChatWindowProps {
	messages: ChatMessage[];
	isLoading: boolean;
	onSendMessage: (message: string) => Promise<void>;
	onClearChat: () => void;
	repository: Repository;
}

const ChatWindow: React.FC<ChatWindowProps> = ({
	messages,
	isLoading,
	onSendMessage,
	onClearChat,
}) => {
	const [newMessage, setNewMessage] = useState<string>("");
	const messagesEndRef = useRef<HTMLDivElement>(null);

	// Quick suggestion questions
	const suggestions = [
		"What does this repository do?",
		"How is the code organized?",
		"What are the main components?",
		"How do I get started?",
		"What dependencies does it use?",
		"How do I install and run this?",
	];

	// Scroll to bottom when messages change
	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [messages]);

	const handleSendMessage = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!newMessage.trim() || isLoading) return;

		const messageToSend = newMessage.trim();
		setNewMessage("");

		try {
			await onSendMessage(messageToSend);
		} catch (error) {
			console.error("Error sending message:", error);
		}
	};

	const handleSuggestionClick = async (suggestion: string) => {
		try {
			await onSendMessage(suggestion);
		} catch (error) {
			console.error("Error sending message:", error);
		}
	};

	const handleClearChat = () => {
		onClearChat();
		console.log("Chat cleared");
	};

	return (
		<>
			{/* Chat Messages */}
			<Box flex="1" p={4} overflowY="auto" bg="gray.50">
				{messages.length === 0 ? (
					<VStack
						spacing={4}
						align="center"
						justify="center"
						h="full"
					>
						<Text color="gray.500" textAlign="center" fontSize="lg">
							👋 Welcome! Ask me anything about this repository
						</Text>
						<Text color="gray.400" textAlign="center" fontSize="sm">
							Try one of the suggestions below to get started
						</Text>
					</VStack>
				) : (
					<VStack spacing={4} align="stretch">
						{messages.map((message) => (
							<Box key={message.id}>
								<HStack
									justify={
										message.role === "user"
											? "flex-end"
											: "flex-start"
									}
									mb={1}
								>
									{message.role === "assistant" && (
										<Box
											w={8}
											h={8}
											bg="blue.500"
											borderRadius="full"
											display="flex"
											alignItems="center"
											justifyContent="center"
											fontSize="sm"
											flexShrink={0}
										>
											🤖
										</Box>
									)}
									<Box
										bg={
											message.role === "user"
												? "blue.500"
												: "white"
										}
										color={
											message.role === "user"
												? "white"
												: "black"
										}
										px={4}
										py={3}
										borderRadius="xl"
										maxW="85%"
										boxShadow="md"
										border={
											message.role === "assistant"
												? "1px solid"
												: "none"
										}
										borderColor="gray.200"
									>
										{message.role === "assistant" ? (
											<Box className="markdown-content">
												<ReactMarkdown>
													{message.content}
												</ReactMarkdown>
											</Box>
										) : (
											<Text>{message.content}</Text>
										)}
									</Box>
									{message.role === "user" && (
										<Box
											w={8}
											h={8}
											bg="gray.400"
											borderRadius="full"
											display="flex"
											alignItems="center"
											justifyContent="center"
											fontSize="sm"
											flexShrink={0}
										>
											👤
										</Box>
									)}
								</HStack>
								<Text
									fontSize="xs"
									color="gray.500"
									textAlign={
										message.role === "user"
											? "right"
											: "left"
									}
									px={message.role === "user" ? 12 : 12}
								>
									{message.timestamp.toLocaleTimeString()}
								</Text>
							</Box>
						))}

						{/* Loading indicator */}
						{isLoading && (
							<HStack>
								<Box
									w={8}
									h={8}
									bg="blue.500"
									borderRadius="full"
									display="flex"
									alignItems="center"
									justifyContent="center"
									fontSize="sm"
								>
									🤖
								</Box>
								<Box
									bg="white"
									px={4}
									py={3}
									borderRadius="xl"
									boxShadow="md"
									border="1px solid"
									borderColor="gray.200"
								>
									<HStack spacing={2}>
										<Spinner size="sm" color="blue.500" />
										<Text color="gray.600">
											Thinking...
										</Text>
									</HStack>
								</Box>
							</HStack>
						)}

						<div ref={messagesEndRef} />
					</VStack>
				)}
			</Box>

			{/* Quick Suggestions */}
			{messages.length <= 1 && (
				<Box p={4} bg="white" borderTopWidth="1px">
					<Text
						fontSize="sm"
						fontWeight="medium"
						mb={3}
						color="gray.600"
					>
						💡 Try asking:
					</Text>
					<Wrap spacing={2}>
						{suggestions.map((suggestion, index) => (
							<WrapItem key={index}>
								<Button
									size="sm"
									variant="outline"
									colorScheme="blue"
									fontSize="xs"
									h="auto"
									py={2}
									px={3}
									whiteSpace="normal"
									textAlign="left"
									onClick={() =>
										handleSuggestionClick(suggestion)
									}
									disabled={isLoading}
									_hover={{ bg: "blue.50" }}
								>
									{suggestion}
								</Button>
							</WrapItem>
						))}
					</Wrap>
				</Box>
			)}

			{/* Chat Input */}
			<Box p={4} bg="white" borderTopWidth="1px">
				<form onSubmit={handleSendMessage}>
					<Flex gap={2} align="end">
						<Input
							value={newMessage}
							onChange={(e) => setNewMessage(e.target.value)}
							placeholder="Ask about the repository..."
							disabled={isLoading}
							resize="none"
							minH="auto"
							rows={1}
						/>
						<HStack spacing={2}>
							{messages.length > 1 && (
								<IconButton
									aria-label="Clear chat"
									icon={<BsTrash />}
									size="md"
									variant="outline"
									colorScheme="red"
									onClick={handleClearChat}
									disabled={isLoading}
								/>
							)}
							<IconButton
								type="submit"
								aria-label="Send message"
								colorScheme="blue"
								size="md"
								disabled={!newMessage.trim() || isLoading}
								_hover={{ transform: "scale(1.05)" }}
								transition="transform 0.2s"
							>
								<BsArrowUp />
							</IconButton>
						</HStack>
					</Flex>
				</form>
			</Box>
		</>
	);
};

export default ChatWindow;
