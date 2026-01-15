"use client";

import * as React from "react";
import { Loader2, Brain, Globe, Sparkles, AlertCircle } from "lucide-react";
import { useUser, useOrganization } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import Image from "next/image";

import { ChatInput } from "@/components/company-brain/chat-input";
import { SourcesDialog, Source } from "@/components/company-brain/sources-dialog";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  sources?: Source[];
  isStreaming?: boolean;
  isError?: boolean;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Tool status type
type ToolStatus = {
  tool: "search_company_brain" | "web_search" | null;
  query: string;
} | null;

interface BrainChatProps {
  chatId?: string | null;
}

export function BrainChat({ chatId }: BrainChatProps) {
  const { user } = useUser();
  const { organization } = useOrganization();
  const router = useRouter();
  const [mounted, setMounted] = React.useState(false);
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [isResponding, setIsResponding] = React.useState(false);
  const [isLoadingChat, setIsLoadingChat] = React.useState(false);
  const [toolStatus, setToolStatus] = React.useState<ToolStatus>(null);
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [streamingContent, setStreamingContent] = React.useState("");
  const [streamingSources, setStreamingSources] = React.useState<Source[]>([]);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const respondingChatIdRef = React.useRef<string | null>(null);
  const [currentChatId, setCurrentChatId] = React.useState<string | null>(chatId || null);
  const prevOrgIdRef = React.useRef<string | undefined>(organization?.id);
  const locallyCreatedChatIdRef = React.useRef<string | null>(null);
  const abortControllerRef = React.useRef<AbortController | null>(null);

  // Handle hydration mismatch
  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Clear chat and redirect when organization changes
  React.useEffect(() => {
    if (prevOrgIdRef.current && organization?.id && prevOrgIdRef.current !== organization.id) {
      setMessages([]);
      setCurrentChatId(null);
      setIsResponding(false);
      setToolStatus(null);
      setIsGenerating(false);
      setStreamingContent("");
      respondingChatIdRef.current = null;
      locallyCreatedChatIdRef.current = null;
      if (chatId) {
        router.push("/company-brain");
      }
    }
    prevOrgIdRef.current = organization?.id;
  }, [organization?.id, chatId, router]);

  // Load chat when chatId changes
  React.useEffect(() => {
    if (chatId) {
      if (locallyCreatedChatIdRef.current === chatId) {
        locallyCreatedChatIdRef.current = null;
        setCurrentChatId(chatId);
        return;
      }
      loadChat(chatId);
    } else {
      if (!isResponding) {
        setMessages([]);
        setCurrentChatId(null);
      }
    }
  }, [chatId]);

  // Auto-scroll when streaming
  React.useEffect(() => {
    if (streamingContent || toolStatus) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [streamingContent, toolStatus]);

  const loadChat = async (id: string) => {
    // Cancel any ongoing stream
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    respondingChatIdRef.current = null;
    setCurrentChatId(id);
    setMessages([]);
    setIsLoadingChat(true);
    setIsResponding(false);
    setToolStatus(null);
    setIsGenerating(false);
    setStreamingContent("");

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
        
        if (data.chat?.status === "loading") {
          setIsResponding(true);
          respondingChatIdRef.current = id;
          pollForResponse(id, loadedMessages.length);
        }
      }
    } catch (error) {
      console.error("Failed to load chat:", error);
    } finally {
      setIsLoadingChat(false);
    }
  };
  
  const pollForResponse = async (id: string, initialMessageCount: number) => {
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/company-brain/chats/${id}`);
        const data = await response.json();
        
        if (response.ok) {
          if (data.chat?.status === "idle" || data.messages.length > initialMessageCount) {
            clearInterval(pollInterval);
            
            if (respondingChatIdRef.current === id) {
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
              setIsResponding(false);
              respondingChatIdRef.current = null;
              
              setTimeout(() => {
                messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
              }, 100);
            }
          }
        }
      } catch (error) {
        console.error("Error polling for response:", error);
      }
    }, 2000);
    
    setTimeout(() => {
      clearInterval(pollInterval);
      if (respondingChatIdRef.current === id) {
        setIsResponding(false);
        respondingChatIdRef.current = null;
      }
    }, 5 * 60 * 1000);
  };

  const handleSendMessage = async (content: string, model: string, enabledTools: string[]) => {
    // Cancel any previous stream
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsResponding(true);
    setToolStatus(null);
    setIsGenerating(false);
    setStreamingContent("");
    setStreamingSources([]);

    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);

    let activeChatId = currentChatId;
    
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
          locallyCreatedChatIdRef.current = activeChatId;
          router.replace(`/company-brain?chat=${activeChatId}`, { scroll: false });
          window.dispatchEvent(new CustomEvent("chat-updated"));
        }
      } catch (error) {
        console.error("Failed to create chat:", error);
        setIsResponding(false);
        return;
      }
    }

    respondingChatIdRef.current = activeChatId;
    window.dispatchEvent(new CustomEvent("chat-activated", { detail: { chatId: activeChatId } }));

    // Create abort controller for this request
    abortControllerRef.current = new AbortController();

    try {
      const conversationHistory = [...messages, userMessage].map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

      setTimeout(() => {
        window.dispatchEvent(new CustomEvent("chat-updated"));
      }, 300);

      const response = await fetch("/api/company-brain/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: conversationHistory,
          model,
          chatId: activeChatId,
          userMessage: content,
          enabledTools,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Request failed");
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";
      let finalContent = "";
      let finalSources: Source[] = [];
      let currentEventType = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          // Parse event type
          if (line.startsWith("event: ")) {
            currentEventType = line.slice(7).trim();
            continue;
          }
          
          // Parse data
          if (line.startsWith("data: ")) {
            let parsedData: unknown;
            try {
              parsedData = JSON.parse(line.slice(6));
            } catch {
              // Skip invalid JSON
              currentEventType = "";
              continue;
            }
            
            const data = parsedData as Record<string, unknown>;
            const eventType = currentEventType;
            currentEventType = ""; // Reset for next event
            
            if (respondingChatIdRef.current !== activeChatId) continue;

            switch (eventType) {
              case "tool_start":
                setToolStatus({ tool: data.tool as "search_company_brain" | "web_search", query: (data.query as string) || "" });
                setIsGenerating(false);
                break;
              case "tool_end":
                setToolStatus(null);
                break;
              case "generating":
                setToolStatus(null);
                setIsGenerating(true);
                break;
              case "text_delta":
                finalContent += data.text as string;
                setStreamingContent(finalContent);
                setIsGenerating(false);
                break;
              case "sources":
                finalSources = data as unknown as Source[];
                setStreamingSources(data as unknown as Source[]);
                break;
              case "done":
                // Finalize the message
                if (finalContent && respondingChatIdRef.current === activeChatId) {
                  const aiMessage: Message = {
                    id: (Date.now() + 1).toString(),
                    role: "assistant",
                    content: finalContent,
                    timestamp: new Date(),
                    sources: finalSources.length > 0 ? finalSources : undefined,
                  };
                  setMessages((prev) => [...prev, aiMessage]);
                  setStreamingContent("");
                  setStreamingSources([]);
                }
                break;
              case "error":
                throw new Error(data.message as string);
            }
          }
        }
      }
    } catch (error) {
      if ((error as Error).name === "AbortError") {
        // Request was cancelled, ignore
        return;
      }
      
      console.error("Chat error:", error);
      if (respondingChatIdRef.current === activeChatId) {
        // Extract meaningful error message
        let errorContent = (error as Error).message || "Unknown error";
        
        // Parse API error messages for better display
        if (errorContent.includes("credit balance is too low")) {
          errorContent = "API credit balance is too low. Please check your Anthropic account billing.";
        } else if (errorContent.includes("rate limit")) {
          errorContent = "Rate limit exceeded. Please wait a moment and try again.";
        } else if (errorContent.includes("invalid_api_key")) {
          errorContent = "Invalid API key. Please check your configuration.";
        }
        
        const errorMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: errorContent,
          timestamp: new Date(),
          isError: true,
        };
        setMessages((prev) => [...prev, errorMessage]);
      }
    } finally {
      if (respondingChatIdRef.current === activeChatId) {
        setIsResponding(false);
        setToolStatus(null);
        setIsGenerating(false);
        respondingChatIdRef.current = null;
      }
      window.dispatchEvent(new CustomEvent("chat-updated"));
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    }
  };

  // Get tool status display
  const getToolStatusDisplay = () => {
    if (toolStatus?.tool === "search_company_brain") {
      return {
        icon: <Brain className="size-4" />,
        text: "Searching Company Brain...",
        color: "text-blue-500",
      };
    }
    if (toolStatus?.tool === "web_search") {
      return {
        icon: <Globe className="size-4" />,
        text: "Searching the web...",
        color: "text-green-500",
      };
    }
    if (isGenerating) {
      return {
        icon: <Sparkles className="size-4" />,
        text: "Generating response...",
        color: "text-purple-500",
      };
    }
    return null;
  };

  const statusDisplay = getToolStatusDisplay();

  return (
    <Card className="flex flex-col flex-1 overflow-hidden relative">
      {isLoadingChat ? (
        <div className="flex flex-col items-center justify-center flex-1 text-center text-muted-foreground">
          <Loader2 className="size-8 animate-spin text-primary mb-4" />
          <p className="text-sm">Loading chat...</p>
        </div>
      ) : messages.length === 0 && !isResponding ? (
        <div className="flex flex-col items-center justify-center flex-1 px-4">
          <h1 className="text-4xl font-bold text-foreground mb-8">
            Hey {mounted ? (user?.firstName || "there") : "there"} 👋
          </h1>
          <div className="w-full max-w-2xl">
            <ChatInput onSendMessage={handleSendMessage} disabled={isResponding} className="!p-0" large autoFocus />
          </div>
        </div>
      ) : (
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
                    ) : message.isError ? (
                      <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4">
                        <div className="flex items-start gap-3">
                          <AlertCircle className="size-5 text-red-500 shrink-0 mt-0.5" />
                          <div>
                            <p className="text-sm font-medium text-red-500 mb-1">Error</p>
                            <p className="text-sm text-red-400/90">
                              {message.content}
                            </p>
                          </div>
                        </div>
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
              
              {/* Streaming response */}
              {isResponding && (
                <div className="flex justify-start">
                  <div className="max-w-full w-full">
                    {/* Tool status or generating status */}
                    {statusDisplay && !streamingContent && (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <div className={`${statusDisplay.color} animate-pulse`}>
                            {statusDisplay.icon}
                          </div>
                          <span className="text-sm font-medium bg-gradient-to-r from-muted-foreground via-foreground to-muted-foreground bg-[length:200%_100%] bg-clip-text text-transparent animate-shimmer">
                            {statusDisplay.text}
                          </span>
                        </div>
                        <div className="space-y-2">
                          <Skeleton className="h-4 w-full max-w-[600px]" />
                          <Skeleton className="h-4 w-full max-w-[500px]" />
                          <Skeleton className="h-4 w-full max-w-[400px]" />
                        </div>
                      </div>
                    )}
                    
                    {/* Streaming text */}
                    {streamingContent ? (
                      <>
                        <div className="markdown-content">
                          <ReactMarkdown>{streamingContent}</ReactMarkdown>
                          <span className="inline-block w-2 h-5 bg-foreground/70 animate-pulse ml-0.5 align-middle" />
                        </div>
                        {streamingSources.length > 0 && (
                          <SourcesDialog sources={streamingSources} />
                        )}
                      </>
                    ) : !statusDisplay && (
                      // Fallback loading state
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <Image
                            src="/logo.png"
                            alt="Company Brain"
                            width={18}
                            height={18}
                            className="opacity-70 animate-pulse"
                          />
                          <span className="text-sm text-muted-foreground">Thinking...</span>
                        </div>
                        <div className="space-y-2">
                          <Skeleton className="h-4 w-full max-w-[600px]" />
                          <Skeleton className="h-4 w-full max-w-[500px]" />
                          <Skeleton className="h-4 w-full max-w-[400px]" />
                        </div>
                      </div>
                    )}
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
