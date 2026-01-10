"use client";

import { ArrowUp } from "lucide-react";
import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface MessageInputProps {
  className?: string;
  placeholder?: string;
  onSubmit?: (message: string) => void;
  disabled?: boolean;
  /** Additional content to render below the input (e.g., action buttons) */
  children?: React.ReactNode;
}

export function MessageInput({
  className,
  placeholder = "Type a message...",
  onSubmit,
  disabled = false,
  children,
}: MessageInputProps) {
  const [message, setMessage] = useState("");

  const handleSend = useCallback(() => {
    if (message.trim() && !disabled) {
      onSubmit?.(message.trim());
      setMessage("");
    }
  }, [message, disabled, onSubmit]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const isEmpty = !message.trim();

  return (
    <div className={cn("p-4 bg-card/95 backdrop-blur-sm", className)}>
      <div className="relative">
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="pr-12 border-border min-h-12 max-h-32 rounded-2xl resize-none py-3 mt-0"
          disabled={disabled}
          style={{
            scrollbarWidth: "thin",
            scrollbarColor: "#737373 transparent",
          }}
          rows={1}
        />
        <Button
          onClick={handleSend}
          className={cn(
            "absolute right-2 top-1/2 transform -translate-y-1/2 p-2 rounded-full transition-all",
            disabled || isEmpty
              ? "bg-muted text-muted-foreground cursor-not-allowed opacity-50"
              : "bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer shadow-sm"
          )}
          disabled={disabled || isEmpty}
          size="icon"
        >
          <ArrowUp className="h-4 w-4" />
        </Button>
      </div>

      {/* Optional action buttons / children below input */}
      {children && (
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          {children}
        </div>
      )}
    </div>
  );
}

