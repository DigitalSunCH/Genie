"use client";

import { useState } from "react";
import { Brain, Send, FileText, Database, Globe, BookOpen } from "lucide-react";
import PageHeader from "@/components/common/page-header";
import PageLayout from "@/components/common/page-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

type ContextSource = {
  id: string;
  title: string;
  type: "document" | "database" | "web" | "knowledge";
  excerpt: string;
  relevance: number;
};

// Mock data for demonstration
const mockContextSources: ContextSource[] = [
  {
    id: "1",
    title: "Company Policies 2024",
    type: "document",
    excerpt: "Section 3.2 outlines the remote work policy including flexible hours and home office equipment allowances...",
    relevance: 95,
  },
  {
    id: "2",
    title: "Employee Handbook",
    type: "knowledge",
    excerpt: "Benefits include health insurance, 401k matching up to 6%, and 20 days of paid time off...",
    relevance: 87,
  },
  {
    id: "3",
    title: "HR Database",
    type: "database",
    excerpt: "Current employee count: 127. Average tenure: 3.2 years. Departments: 8...",
    relevance: 72,
  },
];

const getSourceIcon = (type: ContextSource["type"]) => {
  switch (type) {
    case "document":
      return <FileText className="size-4" />;
    case "database":
      return <Database className="size-4" />;
    case "web":
      return <Globe className="size-4" />;
    case "knowledge":
      return <BookOpen className="size-4" />;
  }
};

const getSourceColor = (type: ContextSource["type"]) => {
  switch (type) {
    case "document":
      return "bg-blue-500/10 text-blue-500";
    case "database":
      return "bg-purple-500/10 text-purple-500";
    case "web":
      return "bg-green-500/10 text-green-500";
    case "knowledge":
      return "bg-orange-500/10 text-orange-500";
  }
};

export default function CompanyBrainPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      role: "assistant",
      content: "Hello! I'm your Company Brain assistant. I have access to all your company's knowledge base, documents, and data. How can I help you today?",
    },
  ]);
  const [input, setInput] = useState("");
  const [contextSources, setContextSources] = useState<ContextSource[]>([]);

  const handleSend = () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");

    // Simulate AI response and context sources
    setTimeout(() => {
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "Based on your company's knowledge base, I found relevant information. The context cards on the right show the sources I used to compile this answer. Let me know if you need more details!",
      };
      setMessages((prev) => [...prev, assistantMessage]);
      setContextSources(mockContextSources);
    }, 1000);
  };

  return (
    <>
      <PageHeader
        titleUrl="/company-brain"
        title="Company Brain"
        icon={<Brain className="size-4" />}
        description="AI-powered knowledge assistant"
      />
      <PageLayout className="p-0 overflow-hidden">
        <div className="flex flex-1 h-full">
          {/* Chat Section */}
          <div className="flex-1 flex flex-col border-r border-border">
            {/* Messages */}
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4 max-w-3xl mx-auto">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex gap-3 ${
                      message.role === "user" ? "justify-end" : "justify-start"
                    }`}
                  >
                    {message.role === "assistant" && (
                      <Avatar className="size-8 shrink-0">
                        <AvatarFallback className="bg-primary text-primary-foreground">
                          <Brain className="size-4" />
                        </AvatarFallback>
                      </Avatar>
                    )}
                    <div
                      className={`rounded-2xl px-4 py-2.5 max-w-[80%] ${
                        message.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      }`}
                    >
                      <p className="text-sm">{message.content}</p>
                    </div>
                    {message.role === "user" && (
                      <Avatar className="size-8 shrink-0">
                        <AvatarFallback>U</AvatarFallback>
                      </Avatar>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>

            {/* Input */}
            <div className="p-4 border-t border-border">
              <div className="flex gap-2 max-w-3xl mx-auto">
                <Input
                  placeholder="Ask anything about your company..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSend()}
                  className="flex-1"
                />
                <Button onClick={handleSend} size="icon">
                  <Send className="size-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Context Sources Section */}
          <div className="w-80 shrink-0 flex flex-col bg-muted/30">
            <div className="p-4 border-b border-border">
              <h3 className="font-semibold text-sm">Context Sources</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Information sources used for the response
              </p>
            </div>
            <ScrollArea className="flex-1 p-4">
              {contextSources.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-center">
                  <Database className="size-8 text-muted-foreground/50 mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Ask a question to see relevant sources
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {contextSources.map((source) => (
                    <Card key={source.id} className="bg-background">
                      <CardHeader className="p-3 pb-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <div
                              className={`p-1.5 rounded-md ${getSourceColor(
                                source.type
                              )}`}
                            >
                              {getSourceIcon(source.type)}
                            </div>
                            <CardTitle className="text-sm font-medium">
                              {source.title}
                            </CardTitle>
                          </div>
                          <span className="text-xs font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                            {source.relevance}%
                          </span>
                        </div>
                      </CardHeader>
                      <CardContent className="p-3 pt-0">
                        <CardDescription className="text-xs line-clamp-3">
                          {source.excerpt}
                        </CardDescription>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>
      </PageLayout>
    </>
  );
}

