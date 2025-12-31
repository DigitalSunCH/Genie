"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { Brain, MessageSquare, Inbox, Upload, FileUp, X, Loader2, PanelLeftClose, PanelLeft } from "lucide-react";
import PageHeader from "@/components/common/page-header";
import PageLayout from "@/components/common/page-layout";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ChatInput } from "@/components/company-brain/chat-input";
import { ApprovalCardStack } from "@/components/company-brain/approval-card-stack";
import { MarkdownContent } from "@/components/company-brain/markdown-content";
import { ThreadList } from "@/components/company-brain/thread-list";
import { supabase } from "@/lib/supabaseClient";
import { Thread, DbMessage } from "@/lib/types/database";

interface Message {
  id: string;
  dbId?: number; // ID from database
  text: string;
  sender: "user" | "ai";
  timestamp: Date;
}

export default function CompanyBrainPage() {
  const { user, isLoaded: isUserLoaded } = useUser();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeThread, setActiveThread] = useState<Thread | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isLoadingThreads, setIsLoadingThreads] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load threads from Supabase when user is loaded
  useEffect(() => {
    if (isUserLoaded && user) {
      loadThreads();
    }
  }, [isUserLoaded, user]);

  const loadThreads = async () => {
    if (!user) return;
    
    setIsLoadingThreads(true);
    try {
      const { data, error } = await supabase
        .from("threads")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setThreads(data || []);
    } catch (error) {
      console.error("Error loading threads:", error);
    } finally {
      setIsLoadingThreads(false);
    }
  };

  const loadMessages = async (thread: Thread) => {
    if (!user) return;
    
    setIsLoadingMessages(true);
    try {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("thread_id", thread.id)
        .order("created_at", { ascending: true });

      if (error) throw error;

      const loadedMessages: Message[] = (data || []).map((msg: DbMessage) => ({
        id: crypto.randomUUID(),
        dbId: msg.id,
        text: msg.content,
        sender: msg.role === "user" ? "user" : "ai",
        timestamp: new Date(msg.created_at),
      }));

      setMessages(loadedMessages);
    } catch (error) {
      console.error("Error loading messages:", error);
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const saveMessage = async (threadId: number, role: "user" | "assistant", content: string) => {
    if (!user) return null;

    try {
      const { data, error } = await supabase
        .from("messages")
        .insert({
          thread_id: threadId,
          role,
          content,
          user_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error("Error saving message:", error);
      return null;
    }
  };

  const handleCreateThread = async () => {
    if (!user) return;
    
    const newThreadId = crypto.randomUUID();
    
    try {
      const { data, error } = await supabase
        .from("threads")
        .insert({
          thread_id: newThreadId,
          name: "Neuer Chat",
          user_id: user.id,
        })
        .select()
        .single();

      if (error) {
        console.error("Supabase error:", error.message, error.details, error.hint);
        throw error;
      }
      
      setThreads((prev) => [data, ...prev]);
      setActiveThread(data);
      setMessages([]);
    } catch (error) {
      console.error("Error creating thread:", error);
    }
  };

  const handleSelectThread = async (threadId: string) => {
    const thread = threads.find((t) => t.thread_id === threadId);
    if (!thread) return;

    setActiveThread(thread);
    await loadMessages(thread);
  };

  const handleRenameThread = async (threadId: string, newName: string) => {
    try {
      const { error } = await supabase
        .from("threads")
        .update({ name: newName })
        .eq("thread_id", threadId);

      if (error) throw error;

      setThreads((prev) =>
        prev.map((t) =>
          t.thread_id === threadId ? { ...t, name: newName } : t
        )
      );

      if (activeThread?.thread_id === threadId) {
        setActiveThread((prev) => prev ? { ...prev, name: newName } : null);
      }
    } catch (error) {
      console.error("Error renaming thread:", error);
    }
  };

  const handleDeleteThread = async (threadId: string) => {
    const thread = threads.find((t) => t.thread_id === threadId);
    if (!thread) return;

    try {
      // First delete all messages in the thread
      const { error: messagesError } = await supabase
        .from("messages")
        .delete()
        .eq("thread_id", thread.id);

      if (messagesError) throw messagesError;

      // Then delete the thread
      const { error } = await supabase
        .from("threads")
        .delete()
        .eq("thread_id", threadId);

      if (error) throw error;

      setThreads((prev) => prev.filter((t) => t.thread_id !== threadId));

      if (activeThread?.thread_id === threadId) {
        setActiveThread(null);
        setMessages([]);
      }
    } catch (error) {
      console.error("Error deleting thread:", error);
    }
  };

  const handleFileSelect = (files: FileList | null) => {
    if (files) {
      setSelectedFiles((prev) => [...prev, ...Array.from(files)]);
    }
  };

  const handleRemoveFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files);
  };

  const handleUpload = () => {
    console.log("Uploading files:", selectedFiles);
    setSelectedFiles([]);
    setIsUploadDialogOpen(false);
  };

  const handleSendMessage = useCallback(async (text: string, model: string) => {
    if (!user) return;
    
    let currentThread = activeThread;

    // Create thread if none exists
    if (!currentThread) {
      const newThreadId = crypto.randomUUID();
      
      try {
        const { data, error } = await supabase
          .from("threads")
          .insert({
            thread_id: newThreadId,
            name: text.slice(0, 50) + (text.length > 50 ? "..." : ""),
            user_id: user.id,
          })
          .select()
          .single();

        if (error) throw error;
        
        currentThread = data;
        setThreads((prev) => [data, ...prev]);
        setActiveThread(data);
      } catch (error) {
        console.error("Error creating thread:", error);
        return;
      }
    }

    // Safety check - should never happen but TypeScript needs it
    if (!currentThread) return;

    // Create and display user message
    const userMessage: Message = {
      id: crypto.randomUUID(),
      text,
      sender: "user",
      timestamp: new Date(),
    };
    
    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    // Save user message to Supabase
    await saveMessage(currentThread.id, "user", text);

    // Create AI message placeholder
    const aiMessageId = crypto.randomUUID();
    const aiMessage: Message = {
      id: aiMessageId,
      text: "",
      sender: "ai",
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, aiMessage]);

    try {
      const apiMessages = [...messages, userMessage].map((msg) => ({
        sender: msg.sender === "user" ? "user" : "assistant",
        text: msg.text,
      }));

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: apiMessages,
          model: model,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to get response from AI");
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error("No response stream available");
      }

      let accumulatedText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n").filter((line) => line.trim());

        for (const line of lines) {
          try {
            const data = JSON.parse(line);
            if (data.text) {
              accumulatedText += data.text;
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === aiMessageId
                    ? { ...msg, text: accumulatedText }
                    : msg
                )
              );
            }
          } catch {
            // Skip invalid JSON lines
          }
        }
      }

      // Save AI response to Supabase after streaming is complete
      if (accumulatedText && currentThread) {
        await saveMessage(currentThread.id, "assistant", accumulatedText);
      }
    } catch (error) {
      console.error("Error sending message:", error);
      const errorText = "Sorry, I encountered an error. Please try again.";
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === aiMessageId
            ? { ...msg, text: errorText }
            : msg
        )
      );
      // Save error message to Supabase
      if (currentThread) {
        await saveMessage(currentThread.id, "assistant", errorText);
      }
    } finally {
      setIsLoading(false);
    }
  }, [messages, activeThread, user]);

  return (
    <>
      <PageHeader
        titleUrl="/company-brain"
        title="Company Brain"
        icon={<Brain className="size-4" />}
      />
      <PageLayout className="h-[calc(100vh-3.5rem)] flex flex-col">
        <Tabs defaultValue="chat" className="w-full flex-1 flex flex-col">
          <TabsList>
            <TabsTrigger value="chat">
              <MessageSquare className="size-4" />
              Chat
            </TabsTrigger>
            <TabsTrigger value="approval-inbox">
              <Inbox className="size-4" />
              Approval Inbox
              <Badge className="ml-1 h-5 min-w-5 px-1.5">3</Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="chat" className="mt-4 flex-1 flex flex-col">
            <div className="flex-1 flex rounded-lg border bg-card overflow-hidden">
              {/* Thread Sidebar */}
              <div
                className={`border-r bg-muted/30 transition-all duration-300 ${
                  isSidebarOpen ? "w-64" : "w-0"
                } overflow-hidden`}
              >
                {isSidebarOpen && (
                  <ThreadList
                    threads={threads}
                    activeThreadId={activeThread?.thread_id || null}
                    onSelectThread={handleSelectThread}
                    onCreateThread={handleCreateThread}
                    onRenameThread={handleRenameThread}
                    onDeleteThread={handleDeleteThread}
                  />
                )}
              </div>

              {/* Chat Area */}
              <div className="flex-1 flex flex-col">
                {/* Sidebar Toggle */}
                <div className="p-2 border-b flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                    className="size-8"
                  >
                    {isSidebarOpen ? (
                      <PanelLeftClose className="size-4" />
                    ) : (
                      <PanelLeft className="size-4" />
                    )}
                  </Button>
                  {activeThread && (
                    <span className="text-sm text-muted-foreground">
                      {activeThread.name || "Chat"}
                    </span>
                  )}
                </div>

                {/* Messages Area */}
                <ScrollArea className="flex-1 p-4">
                  {!isUserLoaded || isLoadingThreads || isLoadingMessages ? (
                    <div className="flex flex-col items-center justify-center h-full min-h-[300px]">
                      <Loader2 className="size-8 animate-spin text-muted-foreground" />
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-center">
                      <div className="rounded-full bg-primary/10 p-4 mb-4">
                        <Brain className="size-8 text-primary" />
                      </div>
                      <h3 className="text-lg font-semibold mb-2">Company Brain</h3>
                      <p className="text-muted-foreground max-w-sm">
                        {activeThread
                          ? "Starte eine Konversation mit dem Company Brain."
                          : "Wähle einen Chat aus oder starte einen neuen."}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {messages.map((message) => (
                        <div
                          key={message.id}
                          className={`flex items-start gap-3 ${
                            message.sender === "user" ? "flex-row-reverse" : ""
                          }`}
                        >
                          <Avatar className="size-8 shrink-0">
                            <AvatarFallback className="text-xs">
                              {message.sender === "user" ? "U" : "AI"}
                            </AvatarFallback>
                          </Avatar>
                          <div
                            className={`rounded-2xl px-4 py-2 max-w-[80%] ${
                              message.sender === "user"
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted"
                            }`}
                          >
                            {message.sender === "ai" && message.text === "" ? (
                              <div className="flex items-center gap-2">
                                <Loader2 className="size-4 animate-spin" />
                                <span className="text-sm text-muted-foreground">Thinking...</span>
                              </div>
                            ) : message.sender === "ai" ? (
                              <MarkdownContent content={message.text} />
                            ) : (
                              <p className="text-sm whitespace-pre-wrap">{message.text}</p>
                            )}
                            {message.text !== "" && (
                              <span className="text-xs opacity-70 mt-1 block">
                                {message.timestamp.toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>

                {/* Chat Input */}
                <ChatInput onSendMessage={handleSendMessage} disabled={isLoading} />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="approval-inbox" className="mt-4 flex-1 flex flex-col">
            <div className="flex justify-end mb-4">
              <Button className="gap-2" onClick={() => setIsUploadDialogOpen(true)}>
                <Upload className="size-4" />
                Upload
              </Button>
            </div>
            <ApprovalCardStack />
          </TabsContent>
        </Tabs>
      </PageLayout>

      {/* Upload Dialog */}
      <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Upload Files</DialogTitle>
            <DialogDescription>
              Upload documents to add to the Company Brain knowledge base.
            </DialogDescription>
          </DialogHeader>

          {/* Drop Zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`
              border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
              ${isDragging 
                ? "border-primary bg-primary/5" 
                : "border-muted-foreground/25 hover:border-muted-foreground/50"
              }
            `}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => handleFileSelect(e.target.files)}
            />
            <FileUp className="size-10 mx-auto mb-3 text-muted-foreground" />
            <p className="text-sm font-medium mb-1">
              Drop files here or click to browse
            </p>
            <p className="text-xs text-muted-foreground">
              Supports PDF, DOC, TXT, and more
            </p>
          </div>

          {/* Selected Files */}
          {selectedFiles.length > 0 && (
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {selectedFiles.map((file, index) => (
                <div
                  key={`${file.name}-${index}`}
                  className="flex items-center justify-between p-2 bg-muted rounded-lg"
                >
                  <span className="text-sm truncate flex-1 mr-2">{file.name}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-6 shrink-0"
                    onClick={() => handleRemoveFile(index)}
                  >
                    <X className="size-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setSelectedFiles([]);
                setIsUploadDialogOpen(false);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpload}
              disabled={selectedFiles.length === 0}
            >
              Upload {selectedFiles.length > 0 && `(${selectedFiles.length})`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
