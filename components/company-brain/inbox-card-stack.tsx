"use client";

import { useState, useEffect } from "react";
import {
  X,
  Check,
  Pencil,
} from "lucide-react";
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
  type: "slack" | "meeting" | "document";
  title: string;
  content: string;
  source: string;
  timestamp: Date;
  sources: SourceData[];
}

// Mock data
const MOCK_ITEMS: InboxItem[] = [
  {
    id: "1",
    type: "slack",
    title: "Product Launch Discussion",
    content: `## Launch Timeline

We've decided to launch the **new feature next Monday**.

### Action Items
- **Marketing team** will prepare the announcement
- **Dev team** needs to ensure all tests pass by Friday
- QA sign-off required by Thursday EOD`,
    source: "#product-team",
    timestamp: new Date(Date.now() - 1000 * 60 * 30),
    sources: [
      {
        id: "slack-1",
        type: "slack",
        count: 12,
        items: [
          { id: "msg-1", title: "Sarah in #product-team", preview: "We've decided to launch the new feature next Monday...", timestamp: new Date(Date.now() - 1000 * 60 * 30) },
          { id: "msg-2", title: "Mike in #product-team", preview: "Marketing team will prepare the announcement", timestamp: new Date(Date.now() - 1000 * 60 * 35) },
          { id: "msg-3", title: "Lisa in #product-team", preview: "Dev team needs to ensure all tests pass by Friday", timestamp: new Date(Date.now() - 1000 * 60 * 40) },
        ],
      },
    ],
  },
  {
    id: "2",
    type: "meeting",
    title: "Q4 Planning Meeting",
    content: `## Key Decisions

1. **Increase focus** on enterprise customers
2. **Hire 3 new engineers** for the platform team
3. **Launch mobile app** by end of Q4

### Budget
Budget approved for new infrastructure upgrades including:
- Cloud scaling improvements
- New monitoring tools
- Security enhancements`,
    source: "Leadership Sync",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2),
    sources: [
      {
        id: "tldv-1",
        type: "tldv",
        count: 2,
        items: [
          { id: "meeting-1", title: "Q4 Planning - Part 1", preview: "Discussion about enterprise focus and hiring plans", timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2) },
          { id: "meeting-2", title: "Q4 Planning - Part 2", preview: "Budget approval and infrastructure roadmap", timestamp: new Date(Date.now() - 1000 * 60 * 60 * 3) },
        ],
      },
      {
        id: "slack-2",
        type: "slack",
        count: 5,
        items: [
          { id: "msg-4", title: "CEO in #leadership", preview: "Great meeting today, key decisions captured", timestamp: new Date(Date.now() - 1000 * 60 * 60 * 1) },
        ],
      },
    ],
  },
  {
    id: "3",
    type: "document",
    title: "Engineering Best Practices",
    content: `## Code Quality Standards

All new code must follow these guidelines:

- **Unit tests** required with >80% coverage
- **PRs require** at least 2 approvals
- **Deploy windows**: Tuesdays and Thursdays only

> Critical hotfixes are exempt from deploy windows but require VP approval.`,
    source: "Engineering Wiki",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24),
    sources: [
      {
        id: "drive-1",
        type: "drive",
        count: 1,
        items: [
          { id: "doc-1", title: "Engineering Standards.docx", preview: "Code quality standards and deployment guidelines", timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24) },
        ],
      },
      {
        id: "slack-3",
        type: "slack",
        count: 8,
        items: [
          { id: "msg-5", title: "CTO in #engineering", preview: "Please review the updated best practices doc", timestamp: new Date(Date.now() - 1000 * 60 * 60 * 20) },
        ],
      },
    ],
  },
];

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

export function InboxCardStack() {
  const [items, setItems] = useState<InboxItem[]>(MOCK_ITEMS);
  const [exitDirection, setExitDirection] = useState<"left" | "right" | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [editedContent, setEditedContent] = useState<string>("");
  const [isEditing, setIsEditing] = useState(false);
  const [selectedSource, setSelectedSource] = useState<SourceData | null>(null);

  const currentItem = items[0];

  // Reset edited content when current item changes
  useEffect(() => {
    if (currentItem) {
      setEditedContent(currentItem.content);
      setIsEditing(false);
    }
  }, [currentItem?.id]);

  const handleDisapprove = () => {
    if (isAnimating) return;
    setExitDirection("left");
    setIsAnimating(true);

    setTimeout(() => {
      setExitDirection(null);
      setItems((prev) => prev.slice(1));
      setIsAnimating(false);
    }, 400);
  };

  const handleApprove = () => {
    if (isAnimating) return;
    setExitDirection("right");
    setIsAnimating(true);

    // TODO: Save with edited content and sources
    console.log("Approved:", {
      ...currentItem,
      content: editedContent,
    });

    setTimeout(() => {
      setExitDirection(null);
      setItems((prev) => prev.slice(1));
      setIsAnimating(false);
    }, 400);
  };

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
      <div className="text-sm text-muted-foreground mb-6">
        {items.length} remaining
      </div>

      {/* Card Stack */}
      <div className="relative w-full max-w-3xl flex-1 mb-4">
        {/* Background cards with actual content */}
        {items.length > 2 && items[2] && (
          <Card className="absolute inset-x-4 top-0 bottom-0 -translate-y-4 bg-card border shadow-md overflow-hidden">
            <div className="px-8 pt-6">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold tracking-tight opacity-60">{items[2].title}</h3>
              </div>
            </div>
          </Card>
        )}
        {items.length > 1 && items[1] && (
          <Card className="absolute inset-x-2 top-0 bottom-0 -translate-y-2 bg-card border shadow-md overflow-hidden">
            <div className="px-8 pt-6">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold tracking-tight opacity-80">{items[1].title}</h3>
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
                    <span className="italic text-muted-foreground/60 text-sm">Click to add notes...</span>
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
                    {source.count} {source.count === 1 ? config.label.replace(/s$/, '') : config.label}
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
                <div
                  key={item.id}
                  className="p-3 rounded-lg bg-muted/50 border border-border/50"
                >
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

        <Button
          onClick={handleApprove}
          disabled={isAnimating}
        >
          <Check className="size-4" />
          Approve
        </Button>
      </div>
    </div>
  );
}

