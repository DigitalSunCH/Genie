"use client";

import { useState, useRef } from "react";
import { Brain, MessageSquare, Inbox, Upload, FileUp, X } from "lucide-react";
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

interface Message {
  id: string;
  text: string;
  sender: "user" | "ai";
  timestamp: Date;
}

export default function CompanyBrainPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    // TODO: Implement actual upload logic
    console.log("Uploading files:", selectedFiles);
    setSelectedFiles([]);
    setIsUploadDialogOpen(false);
  };

  const handleSendMessage = (text: string) => {
    const newMessage: Message = {
      id: crypto.randomUUID(),
      text,
      sender: "user",
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, newMessage]);

    // TODO: Integrate with AI backend
    // For now, add a placeholder AI response
    setTimeout(() => {
      const aiResponse: Message = {
        id: crypto.randomUUID(),
        text: "This is a placeholder response. AI integration coming soon!",
        sender: "ai",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, aiResponse]);
    }, 1000);
  };

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
            <div className="flex-1 flex flex-col rounded-lg border bg-card overflow-hidden">
              {/* Messages Area */}
              <ScrollArea className="flex-1 p-4">
                {messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-center">
                    <div className="rounded-full bg-primary/10 p-4 mb-4">
                      <Brain className="size-8 text-primary" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">Company Brain</h3>
                    <p className="text-muted-foreground max-w-sm">
                      Ask questions about your company&apos;s knowledge base and get instant answers.
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
                          <p className="text-sm">{message.text}</p>
                          <span className="text-xs opacity-70 mt-1 block">
                            {message.timestamp.toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>

              {/* Chat Input */}
              <ChatInput onSendMessage={handleSendMessage} />
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
