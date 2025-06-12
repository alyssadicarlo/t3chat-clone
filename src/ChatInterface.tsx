import { useState, useRef, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { toast } from "sonner";
import { MessageRenderer } from "./MessageRenderer";

export function ChatInterface() {
  const [selectedConversationId, setSelectedConversationId] = useState<Id<"conversations"> | null>(null);
  const [messageInput, setMessageInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  
  const conversations = useQuery(api.chat.getConversations) || [];
  const messages = useQuery(
    api.chat.getMessages,
    selectedConversationId ? { conversationId: selectedConversationId } : "skip"
  ) || [];
  
  const createConversation = useMutation(api.chat.createConversation);
  const sendMessage = useMutation(api.chat.sendMessage);
  const deleteConversation = useMutation(api.chat.deleteConversation);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    if (autoScroll) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  };

  const handleScroll = () => {
    if (!messagesContainerRef.current) return;
    
    const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
    
    setAutoScroll(isNearBottom);
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, autoScroll]);

  const handleNewChat = async () => {
    try {
      const title = "New Chat";
      const conversationId = await createConversation({ title });
      setSelectedConversationId(conversationId);
    } catch (error) {
      toast.error("Failed to create new chat");
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim() || !selectedConversationId || isLoading) return;

    const content = messageInput.trim();
    setMessageInput("");
    setIsLoading(true);
    setAutoScroll(true);

    try {
      await sendMessage({
        conversationId: selectedConversationId,
        content,
      });
    } catch (error) {
      toast.error("Failed to send message");
      setMessageInput(content);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteConversation = async (conversationId: Id<"conversations">) => {
    try {
      await deleteConversation({ conversationId });
      if (selectedConversationId === conversationId) {
        setSelectedConversationId(null);
      }
      toast.success("Chat deleted");
    } catch (error) {
      toast.error("Failed to delete chat");
    }
  };

  return (
    <div className="overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
      {/* Sidebar */}
      <div className="w-72 flex flex-col border-r border-gray-700 fixed left-0 top-16 bottom-0 z-20" style={{ background: 'var(--bg-secondary)' }}>
        <div className="p-4 border-b border-gray-700">
          <button
            onClick={() => void handleNewChat()}
            className="w-full px-4 py-3 bg-purple-600 hover:bg-purple-700 rounded-xl transition-all duration-200 font-medium text-sm flex items-center justify-center gap-2 text-white shadow-lg"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Chat
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          {conversations.map((conversation) => (
            <div
              key={conversation._id}
              className={`group flex items-center justify-between px-4 py-3 hover:bg-gray-700/50 cursor-pointer transition-all duration-200 ${
                selectedConversationId === conversation._id ? "bg-gray-700/70 border-r-2 border-purple-500" : ""
              }`}
              onClick={() => setSelectedConversationId(conversation._id)}
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <span className="truncate text-sm text-gray-200">{conversation.title}</span>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  void handleDeleteConversation(conversation._id);
                }}
                className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-400 transition-all duration-200 p-1 rounded"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex flex-col ml-72 h-screen pt-16 w-[calc(100vw-18rem)]" style={{ background: 'var(--bg-primary)' }}>
        {selectedConversationId ? (
          <>
            {/* Messages */}
            <div 
              ref={messagesContainerRef}
              onScroll={handleScroll}
              className="flex-1 overflow-y-auto"
            >
              {messages.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center text-gray-400 max-w-md">
                    <div className="w-16 h-16 bg-purple-600 rounded-2xl mx-auto mb-6 flex items-center justify-center shadow-lg">
                      <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                    <h3 className="text-2xl font-semibold mb-3 text-white">How can I help you today?</h3>
                    <p className="text-gray-400">Start a conversation by typing a message below.</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-6 p-6">
                  {messages.map((message) => (
                    <div
                      key={message._id}
                      className={`flex gap-4 ${message.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      {message.role === "assistant" && (
                        <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center flex-shrink-0 shadow-lg">
                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                        </div>
                      )}
                      <div
                        className={`max-w-3xl ${
                          message.role === "user"
                            ? "bg-purple-600 text-white rounded-2xl rounded-br-md px-4 py-3 shadow-lg"
                            : "glass border border-gray-600 rounded-2xl rounded-bl-md px-4 py-3 shadow-lg"
                        }`}
                      >
                        {message.role === "user" ? (
                          <div className="whitespace-pre-wrap text-sm leading-relaxed">
                            {message.content}
                          </div>
                        ) : (
                          <MessageRenderer 
                            content={message.content || (message.isStreaming ? "" : "")}
                            isStreaming={message.isStreaming}
                          />
                        )}
                      </div>
                      {message.role === "user" && (
                        <div className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center flex-shrink-0 shadow-lg">
                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                        </div>
                      )}
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* Auto-scroll indicator */}
            {!autoScroll && (
              <div className="absolute bottom-24 right-8 z-10">
                <button
                  onClick={() => {
                    setAutoScroll(true);
                    scrollToBottom();
                  }}
                  className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-2 rounded-full shadow-lg transition-all flex items-center gap-2 text-sm"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                  </svg>
                  Scroll to bottom
                </button>
              </div>
            )}

            {/* Input */}
            <div className="border-t border-gray-700 p-6" style={{ background: 'var(--bg-secondary)' }}>
              <form onSubmit={(e) => void handleSendMessage(e)} className="max-w-4xl mx-auto">
                <div className="flex gap-3 items-end">
                  <div className="flex-1 relative">
                    <textarea
                      value={messageInput}
                      onChange={(e) => setMessageInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          void handleSendMessage(e);
                        }
                      }}
                      placeholder="Type your message... (Shift+Enter for new line)"
                      className="w-full px-4 py-3 pr-12 bg-gray-800 border border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none min-h-[48px] max-h-32 text-white placeholder-gray-400"
                      disabled={isLoading}
                      rows={1}
                      style={{ height: 'auto' }}
                      onInput={(e) => {
                        const target = e.target as HTMLTextAreaElement;
                        target.style.height = 'auto';
                        target.style.height = Math.min(target.scrollHeight, 128) + 'px';
                      }}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={!messageInput.trim() || isLoading}
                    className="px-4 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center min-w-[48px] shadow-lg"
                  >
                    {isLoading ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-gray-400 max-w-md">
              <div className="w-20 h-20 bg-purple-600 rounded-3xl mx-auto mb-8 flex items-center justify-center shadow-xl">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <h3 className="text-3xl font-semibold mb-4 text-purple-400">
                Welcome to ChatGPT Clone
              </h3>
              <p className="text-gray-400 text-lg">Select a chat from the sidebar or create a new one to get started.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
