"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";

import { ChatInput } from "@/components/company-brain/chat-input";
import { SourcesDialog, Source } from "@/components/company-brain/sources-dialog";
import { Card } from "@/components/ui/card";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  sources?: Source[];
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface BrainChatProps {
  chatId?: string | null;
}

export function BrainChat({ chatId }: BrainChatProps) {
  const { user } = useUser();
  const router = useRouter();
  const [mounted, setMounted] = React.useState(false);
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [isResponding, setIsResponding] = React.useState(false);
  const [isLoadingChat, setIsLoadingChat] = React.useState(false);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const respondingChatIdRef = React.useRef<string | null>(null);
  const [currentChatId, setCurrentChatId] = React.useState<string | null>(chatId || null);

  // Handle hydration mismatch
  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Load chat when chatId changes
  React.useEffect(() => {
    if (chatId) {
      loadChat(chatId);
    } else {
      setMessages([]);
      setCurrentChatId(null);
    }
  }, [chatId]);

  // Load a specific chat's messages
  const loadChat = async (id: string) => {
    setIsResponding(false);
    respondingChatIdRef.current = null;
    setCurrentChatId(id);
    setMessages([]);
    setIsLoadingChat(true);

    try {
      const response = await fetch(`/api/company-brain/chats/${id}`);
      const data = await response.json();

      if (response.ok) {
        const loadedMessages: Message[] = data.messages.map(
          (msg: {
            id: string;
            role: "user" | "assistant";
            content: string;
            sources: Source[] | null;
            created_at: string;
          }) => ({
            id: msg.id,
            role: msg.role,
            content: msg.content,
            timestamp: new Date(msg.created_at),
            sources: msg.sources || undefined,
          })
        );
        setMessages(loadedMessages);
      }
    } catch (error) {
      console.error("Failed to load chat:", error);
    } finally {
      setIsLoadingChat(false);
    }
  };

  const handleSendMessage = async (content: string, model: string) => {
    let activeChatId = currentChatId;
    
    // Create chat if none exists
    if (!activeChatId) {
      try {
        const response = await fetch("/api/company-brain/chats", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: "New Chat" }),
        });

        const data = await response.json();

        if (response.ok) {
          activeChatId = data.chat.id;
          setCurrentChatId(activeChatId);
          // Update URL to include the new chat ID
          router.push(`/company-brain?chat=${activeChatId}`);
        }
      } catch (error) {
        console.error("Failed to create chat:", error);
        return;
      }
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsResponding(true);
    respondingChatIdRef.current = activeChatId;

    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);

    try {
      const conversationHistory = [...messages, userMessage].map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

      const response = await fetch("/api/company-brain/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: conversationHistory,
          model,
          chatId: activeChatId,
          userMessage: content,
        }),
      });

      const data = await response.json();
      const stillOnSameChat = respondingChatIdRef.current === activeChatId;

      if (response.ok) {
        if (stillOnSameChat) {
          const aiResponse: Message = {
            id: (Date.now() + 1).toString(),
            role: "assistant",
            content: data.message,
            timestamp: new Date(),
            sources: data.sources || [],
          };
          setMessages((prev) => [...prev, aiResponse]);
        }
      } else {
        if (stillOnSameChat) {
          const errorMessage: Message = {
            id: (Date.now() + 1).toString(),
            role: "assistant",
            content: `Sorry, I encountered an error: ${data.error || "Unknown error"}. Please try again.`,
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, errorMessage]);
        }
      }
    } catch (error) {
      console.error("Chat error:", error);
      if (respondingChatIdRef.current === activeChatId) {
        const errorMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content:
            "Sorry, I couldn't connect to the server. Please check your connection and try again.",
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMessage]);
      }
    } finally {
      if (respondingChatIdRef.current === activeChatId) {
        setIsResponding(false);
        respondingChatIdRef.current = null;
      }
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    }
  };

  return (
    <Card className="flex flex-col flex-1 overflow-hidden relative">
      {isLoadingChat ? (
        <div className="flex flex-col items-center justify-center flex-1 text-center text-muted-foreground">
          <Loader2 className="size-8 animate-spin text-primary mb-4" />
          <p className="text-sm">Loading chat...</p>
        </div>
      ) : messages.length === 0 && !isResponding ? (
        /* Empty state - centered content with chat input */
        <div className="flex flex-col items-center justify-center flex-1 px-4">
          <h1 className="text-4xl font-bold text-foreground mb-8">
            Hey {mounted ? (user?.firstName || "there") : "there"} 👋
          </h1>
          <div className="w-full max-w-2xl">
            <ChatInput onSendMessage={handleSendMessage} disabled={isResponding} className="!p-0" large />
          </div>
        </div>
      ) : (
        /* Messages view */
        <>
          <div className="absolute inset-0 overflow-y-auto">
            <div className="max-w-4xl mx-auto p-4 pb-32 space-y-6">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${
                    message.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={
                      message.role === "user" ? "max-w-[80%]" : "max-w-full"
                    }
                  >
                    {message.role === "user" ? (
                      <div className="inline-block rounded-2xl px-4 py-2.5 bg-muted">
                        <p className="text-sm whitespace-pre-wrap">
                          {message.content}
                        </p>
                      </div>
                    ) : (
                      <>
                        <div className="markdown-content">
                          <ReactMarkdown>{message.content}</ReactMarkdown>
                        </div>
                        {message.sources && message.sources.length > 0 && (
                          <SourcesDialog sources={message.sources} />
                        )}
                      </>
                    )}
                    <p
                      className={`text-xs text-muted-foreground mt-1 ${
                        message.role === "user" ? "text-right px-1" : ""
                      }`}
                    >
                      {formatTime(message.timestamp)}
                    </p>
                  </div>
                </div>
              ))}
              {isResponding && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" />
                    <span className="text-sm">Thinking...</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>

          <div className="absolute bottom-0 left-0 right-0">
            <ChatInput onSendMessage={handleSendMessage} disabled={isResponding} />
          </div>
        </>
      )}
    </Card>
  );
}
