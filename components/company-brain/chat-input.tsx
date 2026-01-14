"use client";

import {
  ArrowUp,
  Check,
  ChevronDown,
  Plus,
  Search,
  Calculator,
  Globe,
  FileText,
  X,
} from "lucide-react";
import Image from "next/image";
import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const AI_MODELS = [
  {
    id: "claude-opus-4-20250514",
    name: "Claude Opus 4.5",
    description: "Most intelligent, best for complex tasks",
  },
] as const;

const TOOLS = [
  {
    id: "web-search",
    name: "Web Search",
    description: "Search the internet for information",
    icon: Globe,
  },
  {
    id: "calculator",
    name: "Calculator",
    description: "Perform calculations and math",
    icon: Calculator,
  },
  {
    id: "document-search",
    name: "Document Search",
    description: "Search through your documents",
    icon: FileText,
  },
  {
    id: "knowledge-search",
    name: "Knowledge Search",
    description: "Search the company knowledge base",
    icon: Search,
  },
] as const;

type AIModelId = (typeof AI_MODELS)[number]["id"];
type ToolId = (typeof TOOLS)[number]["id"];

interface ChatInputProps {
  className?: string;
  onSendMessage?: (message: string, model: string) => void;
  disabled?: boolean;
  large?: boolean;
  autoFocus?: boolean;
}

export function ChatInput({
  className,
  onSendMessage,
  disabled = false,
  large = false,
  autoFocus = false,
}: ChatInputProps) {
  const [message, setMessage] = useState("");
  const [selectedModel, setSelectedModel] = useState<AIModelId>("claude-opus-4-20250514");
  const [selectedTools, setSelectedTools] = useState<ToolId[]>([]);
  const [isModelPopoverOpen, setIsModelPopoverOpen] = useState(false);
  const [isToolPopoverOpen, setIsToolPopoverOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-focus textarea when requested
  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [autoFocus]);

  const currentModel = AI_MODELS.find((m) => m.id === selectedModel)!;
  const availableTools = TOOLS.filter((t) => !selectedTools.includes(t.id));

  const handleSend = () => {
    if (message.trim() && !disabled) {
      onSendMessage?.(message.trim(), selectedModel);
      setMessage("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSelectModel = (modelId: AIModelId) => {
    setSelectedModel(modelId);
    setIsModelPopoverOpen(false);
  };

  const handleSelectTool = (toolId: ToolId) => {
    setSelectedTools((prev) => [...prev, toolId]);
    setIsToolPopoverOpen(false);
  };

  const handleRemoveTool = (toolId: ToolId) => {
    setSelectedTools((prev) => prev.filter((id) => id !== toolId));
  };

  return (
    <div
      className={`sticky bottom-0 p-4 max-w-4xl mx-auto w-full ${className}`}
    >
      <div className="relative">
        <Textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask the Company Brain..."
          className={`pr-12 border-border rounded-2xl resize-none py-3 mt-0 !bg-muted ${
            large ? "min-h-[120px] max-h-48 text-lg" : "min-h-12 max-h-32"
          }`}
          disabled={disabled}
          style={{
            scrollbarWidth: "thin",
            scrollbarColor: "#737373 transparent",
          }}
          rows={large ? 3 : 1}
        />
        <Button
          onClick={handleSend}
          className={`absolute right-2 top-1/2 transform -translate-y-1/2 p-2 rounded-full transition-all ${
            disabled || !message.trim()
              ? "bg-muted text-muted-foreground cursor-not-allowed opacity-50"
              : "bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer shadow-sm"
          }`}
          disabled={disabled || !message.trim()}
          size="icon"
        >
          <ArrowUp className="h-4 w-4" />
        </Button>
      </div>

      {/* Action buttons below input */}
      <div className="flex items-center gap-2 mt-2 flex-wrap bg-muted rounded-full px-2 py-1 w-fit">
        {/* AI Model Selector */}
        <Popover open={isModelPopoverOpen} onOpenChange={setIsModelPopoverOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="rounded-full gap-1.5"
            >
              <Image src="/claude.png" alt="Claude" width={14} height={14} className="rounded-sm" />
              {currentModel.name}
              <ChevronDown className="size-3 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-64 p-2">
            <div className="space-y-1">
              {AI_MODELS.map((model) => (
                <button
                  key={model.id}
                  onClick={() => handleSelectModel(model.id)}
                  className="w-full flex items-start gap-3 p-2 rounded-lg hover:bg-muted transition-colors text-left"
                >
                  <Image src="/claude.png" alt="Claude" width={16} height={16} className="rounded-sm mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{model.name}</span>
                      {selectedModel === model.id && (
                        <Check className="size-4 text-primary" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {model.description}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {/* Selected Tools */}
        {selectedTools.map((toolId) => {
          const tool = TOOLS.find((t) => t.id === toolId)!;
          return (
            <Button
              key={tool.id}
              variant="secondary"
              size="sm"
              className="rounded-full gap-1.5 pr-1.5"
              onClick={() => handleRemoveTool(tool.id)}
            >
              <tool.icon className="size-3.5" />
              {tool.name}
              <span className="ml-0.5 rounded-full hover:bg-muted-foreground/20 p-0.5">
                <X className="size-3" />
              </span>
            </Button>
          );
        })}

        {/* Add Tool Button */}
        {availableTools.length > 0 && (
          <Popover open={isToolPopoverOpen} onOpenChange={setIsToolPopoverOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="rounded-full gap-1.5 text-muted-foreground hover:text-foreground"
              >
                <Plus className="size-3.5" />
                Add tool
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-64 p-2">
              <div className="space-y-1">
                {availableTools.map((tool) => (
                  <button
                    key={tool.id}
                    onClick={() => handleSelectTool(tool.id)}
                    className="w-full flex items-start gap-3 p-2 rounded-lg hover:bg-muted transition-colors text-left"
                  >
                    <tool.icon className="size-4 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium">{tool.name}</span>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {tool.description}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>
    </div>
  );
}

