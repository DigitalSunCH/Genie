"use client";

import * as React from "react";
import { Brain, MessageSquare, Inbox, Loader2, Hash, ExternalLink, MessageCircle, Plus, Ellipsis, Trash2, Share2 } from "lucide-react";
import { useOrganization } from "@clerk/nextjs";
import ReactMarkdown from "react-markdown";

import PageHeader from "@/components/common/page-header";
import { ManageSlackChannelsDialog } from "@/components/company-brain/manage-slack-channels-dialog";
import { ManageDriveFoldersDialog } from "@/components/company-brain/manage-drive-folders-dialog";
import { ManageUploadedFilesDialog } from "@/components/company-brain/manage-uploaded-files-dialog";
import { ManageGmailAddressesDialog } from "@/components/company-brain/manage-gmail-addresses-dialog";
import { ManageTldvDialog } from "@/components/company-brain/manage-tldv-dialog";
import { ChatInput } from "@/components/company-brain/chat-input";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface SlackChannel {
  id: string;
  slack_channel_id: string;
  slack_channel_name: string | null;
  created_at: string;
}

interface Source {
  type: "slack";
  channelName: string;
  userName: string;
  timestamp: string;
  text: string;
  slackLink: string;
  isThread: boolean;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  sources?: Source[];
}

interface Chat {
  id: string;
  title: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

// Sources Dialog Component
function SourcesDialog({ 
  sources, 
  groupSourcesByChannel,
  formatSourceDate,
  truncateText,
}: { 
  sources: Source[];
  groupSourcesByChannel: (sources: Source[]) => Record<string, Source[]>;
  formatSourceDate: (timestamp: string) => string;
  truncateText: (text: string, maxLength?: number) => string;
}) {
  const groupedSources = groupSourcesByChannel(sources);
  const channelCount = Object.keys(groupedSources).length;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-7 gap-1.5 text-xs rounded-full px-3 bg-muted/50 border-border/50 hover:bg-muted mt-3"
        >
          <svg className="size-3.5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/>
          </svg>
          <span>{sources.length} source{sources.length !== 1 ? "s" : ""}</span>
          <span className="text-muted-foreground">from {channelCount} channel{channelCount !== 1 ? "s" : ""}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl w-[90vw] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <svg className="size-5 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
              <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/>
            </svg>
            Sources from Slack
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-4 pr-4">
            {Object.entries(groupedSources).map(([channelName, channelSources]) => (
              <div key={channelName} className="space-y-2">
                <div className="flex items-center gap-1.5 text-sm font-medium sticky top-0 bg-background py-1">
                  <Hash className="size-4 text-muted-foreground flex-shrink-0" />
                  <span className="truncate">{channelName}</span>
                  <span className="text-xs text-muted-foreground font-normal flex-shrink-0">
                    ({channelSources.length})
                  </span>
                </div>
                <div className="space-y-2">
                  {channelSources.map((source, index) => (
                    <a
                      key={index}
                      href={source.slackLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group block p-3 rounded-lg border border-border/50 hover:border-border hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0 overflow-hidden">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="text-sm font-medium truncate">{source.userName}</span>
                            <span className="text-xs text-muted-foreground flex-shrink-0">
                              {formatSourceDate(source.timestamp)}
                            </span>
                            {source.isThread && (
                              <span className="flex items-center gap-1 text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded flex-shrink-0">
                                <MessageCircle className="size-3" />
                                Thread
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground break-words whitespace-pre-wrap">
                            {truncateText(source.text, 250)}
                          </p>
                        </div>
                        <ExternalLink className="size-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

export default function CompanyBrainPage() {
  const { organization } = useOrganization();
  const [channels, setChannels] = React.useState<SlackChannel[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [activeTab, setActiveTab] = React.useState("chat");
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [isResponding, setIsResponding] = React.useState(false);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const respondingChatIdRef = React.useRef<string | null>(null);
  
  // Chat management state
  const [chats, setChats] = React.useState<Chat[]>([]);
  const [currentChatId, setCurrentChatId] = React.useState<string | null>(null);
  const [isLoadingChats, setIsLoadingChats] = React.useState(true);
  const [isCreatingChat, setIsCreatingChat] = React.useState(false);
  const [isLoadingChat, setIsLoadingChat] = React.useState(false);

  // Fetch all chats for the organization
  const fetchChats = React.useCallback(async () => {
    if (!organization) return;

    try {
      const response = await fetch("/api/company-brain/chats");
      const data = await response.json();

      if (response.ok) {
        setChats(data.chats || []);
      }
    } catch (error) {
      console.error("Failed to fetch chats:", error);
    } finally {
      setIsLoadingChats(false);
    }
  }, [organization]);

  // Load a specific chat's messages
  const loadChat = React.useCallback(async (chatId: string) => {
    // Clear responding state when switching chats
    setIsResponding(false);
    respondingChatIdRef.current = null;
    setCurrentChatId(chatId);
    setMessages([]);
    setIsLoadingChat(true);
    
    try {
      const response = await fetch(`/api/company-brain/chats/${chatId}`);
      const data = await response.json();

      if (response.ok) {
        // Convert database messages to our Message format
        const loadedMessages: Message[] = data.messages.map((msg: { id: string; role: "user" | "assistant"; content: string; sources: Source[] | null; created_at: string }) => ({
          id: msg.id,
          role: msg.role,
          content: msg.content,
          timestamp: new Date(msg.created_at),
          sources: msg.sources || undefined,
        }));
        setMessages(loadedMessages);
      }
    } catch (error) {
      console.error("Failed to load chat:", error);
    } finally {
      setIsLoadingChat(false);
    }
  }, []);

  // Create a new chat
  const createNewChat = async () => {
    // Clear responding state when creating new chat
    setIsResponding(false);
    respondingChatIdRef.current = null;
    
    setIsCreatingChat(true);
    try {
      const response = await fetch("/api/company-brain/chats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "New Chat" }),
      });

      const data = await response.json();

      if (response.ok) {
        setChats((prev) => [data.chat, ...prev]);
        setCurrentChatId(data.chat.id);
        setMessages([]);
      }
    } catch (error) {
      console.error("Failed to create chat:", error);
    } finally {
      setIsCreatingChat(false);
    }
  };

  // Delete a chat
  const deleteChat = async (chatId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const response = await fetch(`/api/company-brain/chats/${chatId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setChats((prev) => prev.filter((c) => c.id !== chatId));
        if (currentChatId === chatId) {
          setCurrentChatId(null);
          setMessages([]);
        }
      }
    } catch (error) {
      console.error("Failed to delete chat:", error);
    }
  };

  const fetchConnectedChannels = React.useCallback(async () => {
    if (!organization) return;

    try {
      const response = await fetch("/api/slack/channels/connected");
      const data = await response.json();

      if (response.ok) {
        setChannels(data.channels || []);
      }
    } catch (error) {
      console.error("Failed to fetch connected channels:", error);
    } finally {
      setIsLoading(false);
    }
  }, [organization]);

  React.useEffect(() => {
    fetchConnectedChannels();
    fetchChats();
  }, [fetchConnectedChannels, fetchChats]);

  const handleRemoveChannel = async (channelId: string) => {
    try {
      const response = await fetch(`/api/slack/channels/${channelId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        fetchConnectedChannels();
      }
    } catch (error) {
      console.error("Failed to remove channel:", error);
    }
  };

  const handleSendMessage = async (content: string, model: string) => {
    // Create chat if none exists
    let chatId = currentChatId;
    if (!chatId) {
      try {
        const response = await fetch("/api/company-brain/chats", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: "New Chat" }),
        });

        const data = await response.json();

        if (response.ok) {
          chatId = data.chat.id;
          setChats((prev) => [data.chat, ...prev]);
          setCurrentChatId(chatId);
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
    respondingChatIdRef.current = chatId; // Track which chat is expecting a response

    // Scroll to bottom after adding message
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);

    try {
      // Prepare conversation history for API
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
          chatId,
          userMessage: content,
        }),
      });

      const data = await response.json();

      // Only update UI if we're still on the same chat
      const stillOnSameChat = respondingChatIdRef.current === chatId;

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
        
        // Refresh chat list to get updated titles
        fetchChats();
      } else {
        // Handle error - only show if still on same chat
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
      // Only show error if still on same chat
      if (respondingChatIdRef.current === chatId) {
        const errorMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: "Sorry, I couldn't connect to the server. Please check your connection and try again.",
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMessage]);
      }
    } finally {
      // Only clear responding state if this was the chat that was responding
      if (respondingChatIdRef.current === chatId) {
        setIsResponding(false);
        respondingChatIdRef.current = null;
      }
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatSourceDate = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const truncateText = (text: string, maxLength: number = 150) => {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength).trim() + "...";
  };

  // Group sources by channel
  const groupSourcesByChannel = (sources: Source[]) => {
    const grouped: Record<string, Source[]> = {};
    for (const source of sources) {
      if (!grouped[source.channelName]) {
        grouped[source.channelName] = [];
      }
      grouped[source.channelName].push(source);
    }
    return grouped;
  };

  // Format relative date for chat list
  const formatChatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  };

  return (
    <>
      <PageHeader
        titleUrl="/company-brain"
        title="Company Brain"
        icon={<Brain className="size-4" />}
      />
      {/* Fixed height container - no PageLayout to avoid flex-grow issues */}
      <div className="flex flex-col p-4 pt-0 h-[calc(100vh-3.5rem)] overflow-hidden">
        <Card className="flex flex-col flex-1 p-6 border-0 shadow-none bg-muted/40 overflow-hidden">
          {/* Top Bar - Fixed height */}
          <div className="flex items-center justify-between flex-shrink-0">
            {/* Left: Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList>
                <TabsTrigger value="chat" className="gap-1.5">
                  <MessageSquare className="size-4" />
                  Chat
                </TabsTrigger>
                <TabsTrigger value="inbox" className="gap-1.5">
                  <Inbox className="size-4" />
                  Inbox
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Right: Data Source Buttons */}
            <div className="flex items-center gap-2">
              <ManageSlackChannelsDialog
                channels={channels}
                isLoading={isLoading}
                onChannelAdded={fetchConnectedChannels}
                onChannelRemoved={handleRemoveChannel}
              />
              <ManageTldvDialog />
              <ManageDriveFoldersDialog />
              <ManageGmailAddressesDialog />
              <ManageUploadedFilesDialog />
            </div>
          </div>

          {/* Main Content Area with Chat List */}
          <div className="flex flex-1 gap-4 overflow-hidden">
            {/* Chat List Sidebar */}
            {activeTab === "chat" && (
              <Card className="w-72 flex-shrink-0 flex flex-col overflow-hidden mt-0 gap-0 py-0">
                <div className="p-3 border-b flex items-center justify-between">
                  <p className="font-bold">Chats</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={createNewChat}
                    disabled={isCreatingChat}
                    className="h-8 w-8 p-0"
                  >
                    {isCreatingChat ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Plus className="size-4" />
                    )}
                  </Button>
                </div>
                <ScrollArea className="flex-1">
                  <div className="p-2 space-y-1">
                    {isLoadingChats ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="size-5 animate-spin text-muted-foreground" />
                      </div>
                    ) : chats.length === 0 ? (
                      <div className="text-center py-8 px-4">
                        <p className="text-sm text-muted-foreground">
                          No chats yet. Start a conversation!
                        </p>
                      </div>
                    ) : (
                      chats.map((chat) => (
                        <div
                          key={chat.id}
                          onClick={() => loadChat(chat.id)}
                          className={`w-full group flex items-start gap-2 p-2.5 rounded-lg text-left transition-colors cursor-pointer ${
                            currentChatId === chat.id
                              ? "bg-primary/10 text-primary"
                              : "hover:bg-muted"
                          }`}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {chat.title}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatChatDate(chat.updated_at)}
                            </p>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                onClick={(e) => e.stopPropagation()}
                                className="cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
                                variant="ghost"
                                size="icon"
                              >
                                <Ellipsis className="size-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={(e) => {
                                e.stopPropagation();
                                // TODO: Implement share functionality
                                console.log("Share chat:", chat.id);
                              }}>
                                <Share2 className="size-4 mr-2" />
                                Share
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={(e) => deleteChat(chat.id, e)}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="size-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </Card>
            )}

            {/* Main Chat Card */}
            <Card className="flex flex-col flex-1 overflow-hidden relative">
              {activeTab === "chat" ? (
                <>
                  {/* Messages Area - Scrollable, full height with padding for input */}
                  <div className="absolute inset-0 overflow-y-auto">
                    <div className="max-w-4xl mx-auto p-4 pb-32 space-y-6">
                    {isLoadingChat ? (
                      <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-center text-muted-foreground">
                        <Loader2 className="size-8 animate-spin text-primary mb-4" />
                        <p className="text-sm">Loading chat...</p>
                      </div>
                    ) : messages.length === 0 && !isResponding ? (
                      <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-center text-muted-foreground">
                        <div className="rounded-full bg-primary/10 p-4 mb-4">
                          <Brain className="size-8 text-primary" />
                        </div>
                        <h3 className="text-lg font-semibold mb-2 text-foreground">
                          Ask the Company Brain
                        </h3>
                        <p className="max-w-sm">
                          Ask questions about your company&apos;s Slack conversations, meetings, and documents.
                        </p>
                      </div>
                    ) : (
                      <>
                        {messages.map((message) => (
                          <div
                            key={message.id}
                            className={`flex ${
                              message.role === "user" ? "justify-end" : "justify-start"
                            }`}
                          >
                            {/* Message Content */}
                            <div className={message.role === "user" ? "max-w-[80%]" : "max-w-full"}>
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
                                  {/* Sources Badge */}
                                  {message.sources && message.sources.length > 0 && (
                                    <SourcesDialog sources={message.sources} groupSourcesByChannel={groupSourcesByChannel} formatSourceDate={formatSourceDate} truncateText={truncateText} />
                                  )}
                                </>
                              )}
                              <p className={`text-xs text-muted-foreground mt-1 ${
                                message.role === "user" ? "text-right px-1" : ""
                              }`}>
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
                      </>
                    )}
                    <div ref={messagesEndRef} />
                    </div>
                  </div>

                  {/* Chat Input - Absolute positioned at bottom */}
                  <div className="absolute bottom-0 left-0 right-0">
                    <ChatInput onSendMessage={handleSendMessage} disabled={isResponding} />
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center text-muted-foreground">
                    <div className="rounded-full bg-primary/10 p-4 mb-4 mx-auto w-fit">
                      <Inbox className="size-8 text-primary" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2 text-foreground">
                      Inbox
                    </h3>
                    <p className="max-w-sm">
                      Review and approve suggested knowledge from your connected
                      channels.
                    </p>
                  </div>
                </div>
              )}
            </Card>
          </div>
        </Card>
      </div>
    </>
  );
}
