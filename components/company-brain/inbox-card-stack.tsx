"use client";

import { useState, useEffect, useCallback } from "react";
import { X, Check, Pencil, Loader2 } from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MarkdownContent } from "@/components/company-brain/markdown-content";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

// Types
interface SourceData {
  id: string;
  type: "slack" | "tldv" | "drive" | "gmail";
  count: number;
  items: {
    id: string;
    title: string;
    preview: string;
    timestamp: Date;
  }[];
}

interface InboxItem {
  id: string;
  type: "topic" | "meeting";
  title: string;
  summary: string | null;
  sourceData: Record<string, unknown>;
  status: string;
  topicId: string | null;
  meetingId: string | null;
  tldvUrl: string | null;
  createdAt: string;
}

interface TransformedItem {
  id: string;
  type: "slack" | "meeting" | "document";
  title: string;
  content: string;
  source: string;
  timestamp: Date;
  sources: SourceData[];
  originalItem: InboxItem;
}

const sourceConfig = {
  slack: {
    label: "Slack messages",
    icon: "/slack.png",
  },
  tldv: {
    label: "tldv meetings",
    icon: "/tldv.png",
  },
  drive: {
    label: "Drive files",
    icon: "/drive.png",
  },
  gmail: {
    label: "Gmail emails",
    icon: "/gmail.png",
  },
};

function transformInboxItem(item: InboxItem): TransformedItem {
  const sourceData = item.sourceData || {};

  // Build sources array based on item type
  const sources: SourceData[] = [];

  if (item.type === "topic") {
    // Slack topic
    const messages = (sourceData.messages as Array<{ userName: string; text: string; timestamp: string }>) || [];
    sources.push({
      id: `slack-${item.id}`,
      type: "slack",
      count: (sourceData.messageCount as number) || messages.length,
      items: messages.slice(0, 10).map((m, i) => ({
        id: `msg-${i}`,
        title: m.userName || "Unknown",
        preview: m.text || "",
        timestamp: new Date(m.timestamp),
      })),
    });

    return {
      id: item.id,
      type: "slack",
      title: item.title,
      content: item.summary || "No summary available.",
      source: `#${sourceData.channelName || "channel"}`,
      timestamp: new Date(item.createdAt),
      sources,
      originalItem: item,
    };
  } else if (item.type === "meeting") {
    // tldv meeting
    sources.push({
      id: `tldv-${item.id}`,
      type: "tldv",
      count: 1,
      items: [
        {
          id: item.meetingId || item.id,
          title: (sourceData.meetingTitle as string) || item.title,
          preview: (sourceData.fullSummary as string)?.slice(0, 200) || "",
          timestamp: new Date((sourceData.happenedAt as string) || item.createdAt),
        },
      ],
    });

    // Build content with action items and key topics
    let content = item.summary || "No summary available.";

    const keyTopics = sourceData.keyTopics as string[] | undefined;
    const actionItems = sourceData.actionItems as string[] | undefined;

    if (keyTopics && keyTopics.length > 0) {
      content += "\n\n### Key Topics\n" + keyTopics.map((t) => `- ${t}`).join("\n");
    }

    if (actionItems && actionItems.length > 0) {
      content += "\n\n### Action Items\n" + actionItems.map((a) => `- ${a}`).join("\n");
    }

    return {
      id: item.id,
      type: "meeting",
      title: item.title,
      content,
      source: (sourceData.meetingTitle as string) || "Meeting",
      timestamp: new Date((sourceData.happenedAt as string) || item.createdAt),
      sources,
      originalItem: item,
    };
  }

  // Fallback
  return {
    id: item.id,
    type: "document",
    title: item.title,
    content: item.summary || "No content available.",
    source: "Unknown",
    timestamp: new Date(item.createdAt),
    sources: [],
    originalItem: item,
  };
}

interface InboxCardStackProps {
  onCountChange?: (count: number) => void;
  onApprove?: () => void;
}

export function InboxCardStack({ onCountChange, onApprove }: InboxCardStackProps) {
  const [items, setItems] = useState<TransformedItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [exitDirection, setExitDirection] = useState<"left" | "right" | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [editedContent, setEditedContent] = useState<string>("");
  const [isEditing, setIsEditing] = useState(false);
  const [selectedSource, setSelectedSource] = useState<SourceData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const currentItem = items[0];

  // Sync count with parent whenever items change
  useEffect(() => {
    onCountChange?.(items.length);
  }, [items.length, onCountChange]);

  // Fetch inbox items
  const fetchItems = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch("/api/company-brain/inbox");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch inbox items");
      }

      const transformed = (data.items || []).map(transformInboxItem);
      setItems(transformed);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load inbox");
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // Reset edited content when current item changes
  useEffect(() => {
    if (currentItem) {
      setEditedContent(currentItem.content);
      setIsEditing(false);
    }
  }, [currentItem?.id]);

  const handleDisapprove = () => {
    if (isAnimating || !currentItem) return;

    const itemId = currentItem.originalItem.id;

    // Optimistic UI - immediately animate out
    setExitDirection("left");
    setIsAnimating(true);

    // Fire and forget - API call in background
    fetch(`/api/company-brain/inbox/${itemId}/dismiss`, { method: "POST" })
      .catch((err) => console.error("Error dismissing item:", err));

    setTimeout(() => {
      setExitDirection(null);
      setItems((prev) => prev.slice(1));
      setIsAnimating(false);
    }, 400);
  };

  const handleApprove = () => {
    if (isAnimating || !currentItem) return;

    const itemId = currentItem.originalItem.id;

    // Optimistic UI - immediately animate out
    setExitDirection("right");
    setIsAnimating(true);

    // Fire and forget - API call in background, then refresh sources
    fetch(`/api/company-brain/inbox/${itemId}/approve`, { method: "POST" })
      .then(() => {
        // Refresh data sources after successful approval
        onApprove?.();
      })
      .catch((err) => console.error("Error approving item:", err));

    setTimeout(() => {
      setExitDirection(null);
      setItems((prev) => prev.slice(1));
      setIsAnimating(false);
    }, 400);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px]">
        <Loader2 className="size-8 animate-spin text-muted-foreground mb-4" />
        <p className="text-muted-foreground">Loading inbox...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center">
        <div className="rounded-full bg-destructive/10 p-5 mb-5">
          <X className="size-10 text-destructive" />
        </div>
        <h3 className="text-xl font-semibold mb-2">Error loading inbox</h3>
        <p className="text-muted-foreground max-w-sm text-sm mb-4">{error}</p>
        <Button onClick={fetchItems} variant="outline">
          Try Again
        </Button>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center">
        <div className="rounded-full bg-emerald-500/10 p-5 mb-5">
          <Check className="size-10 text-emerald-500" />
        </div>
        <h3 className="text-xl font-semibold mb-2">All caught up!</h3>
        <p className="text-muted-foreground max-w-sm text-sm">
          You&apos;ve reviewed all pending items. Check back later for new suggestions.
        </p>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col items-center h-full w-full px-4 pt-4 pb-20">
      {/* Counter */}
      <div className="text-sm text-muted-foreground mb-6">{items.length} remaining</div>

      {/* Card Stack */}
      <div className="relative w-full max-w-3xl flex-1 mb-4">
        {/* Background cards with actual content */}
        {items.length > 2 && items[2] && (
          <Card className="absolute inset-x-4 top-0 bottom-0 -translate-y-4 bg-card border shadow-md overflow-hidden">
            <div className="px-8 pt-6">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold tracking-tight opacity-60">
                  {items[2].title}
                </h3>
              </div>
            </div>
          </Card>
        )}
        {items.length > 1 && items[1] && (
          <Card className="absolute inset-x-2 top-0 bottom-0 -translate-y-2 bg-card border shadow-md overflow-hidden">
            <div className="px-8 pt-6">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold tracking-tight opacity-80">
                  {items[1].title}
                </h3>
              </div>
            </div>
            <div className="px-8 mt-4">
              <div className="bg-muted/30 rounded-lg p-4 h-[300px] overflow-hidden border border-border opacity-80">
                <MarkdownContent content={items[1].content} />
              </div>
            </div>
          </Card>
        )}

        {/* Current card */}
        <Card
          key={currentItem.id}
          className={cn(
            "relative flex flex-col h-full overflow-hidden transition-all duration-400 ease-out shadow-xl",
            exitDirection === "left" && "-translate-x-[120%] -rotate-12 opacity-0",
            exitDirection === "right" && "translate-x-[120%] rotate-12 opacity-0"
          )}
        >
          {/* Header */}
          <div className="relative px-8">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-semibold tracking-tight">{currentItem.title}</h3>
              <span className="text-xs text-muted-foreground font-medium">
                {currentItem.timestamp.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          </div>

          {/* Content - Editable */}
          <div className="relative px-8 flex-1 ">
            <div className="relative group">
              {isEditing ? (
                <textarea
                  value={editedContent}
                  onChange={(e) => setEditedContent(e.target.value)}
                  onBlur={() => setIsEditing(false)}
                  className="w-full h-[300px] text-sm leading-relaxed text-foreground bg-muted/50 rounded-lg p-4 border border-border/50 focus:border-ring focus:ring-2 focus:ring-ring/20 outline-none resize-none overflow-y-auto transition-all"
                  placeholder="Add your notes..."
                  autoFocus
                />
              ) : (
                <div
                  onClick={() => setIsEditing(true)}
                  className="relative bg-muted/30 rounded-lg p-4 h-[300px] overflow-y-auto cursor-text hover:bg-muted/50 transition-colors border border-border group"
                >
                  {editedContent ? (
                    <MarkdownContent content={editedContent} />
                  ) : (
                    <span className="italic text-muted-foreground/60 text-sm">
                      Click to add notes...
                    </span>
                  )}
                  <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Pencil className="size-4 text-muted-foreground/60" />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Source Buttons */}
          <div className="px-8 pb-6">
            <p className="text-xs text-muted-foreground mb-3 font-medium uppercase tracking-wider">
              Sources
            </p>
            <div className="flex flex-wrap gap-2">
              {currentItem.sources.map((source) => {
                const config = sourceConfig[source.type];
                return (
                  <Button
                    key={source.id}
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedSource(source)}
                    className="rounded-full gap-2"
                  >
                    <Image
                      src={config.icon}
                      alt={source.type}
                      width={16}
                      height={16}
                      className="size-4"
                    />
                    {source.count} {source.count === 1 ? config.label.replace(/s$/, "") : config.label}
                  </Button>
                );
              })}
            </div>
          </div>
        </Card>
      </div>

      {/* Source Details Dialog */}
      <Dialog open={!!selectedSource} onOpenChange={() => setSelectedSource(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedSource && (
                <>
                  <Image
                    src={sourceConfig[selectedSource.type].icon}
                    alt={selectedSource.type}
                    width={20}
                    height={20}
                  />
                  {selectedSource.count} {sourceConfig[selectedSource.type].label}
                </>
              )}
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[400px]">
            <div className="space-y-3">
              {selectedSource?.items.map((item) => (
                <div key={item.id} className="p-3 rounded-lg bg-muted/50 border border-border/50">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">{item.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {item.timestamp.toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">{item.preview}</p>
                </div>
              ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Action Buttons - Fixed at bottom */}
      <div className="absolute bottom-6 left-0 right-0 flex items-center justify-center gap-3">
        <Button
          variant="outline"
          onClick={handleDisapprove}
          disabled={isAnimating}
        >
          <X className="size-4" />
          Disapprove
        </Button>

        <Button onClick={handleApprove} disabled={isAnimating}>
          <Check className="size-4" />
          Approve
        </Button>
      </div>
    </div>
  );
}
