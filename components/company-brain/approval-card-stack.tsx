"use client";

import { useState } from "react";
import {
  MessageSquare,
  FileText,
  Calendar,
  X,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface ApprovalItem {
  id: string;
  type: "slack" | "meeting" | "document";
  title: string;
  content: string;
  source: string;
  timestamp: Date;
}

const MOCK_ITEMS: ApprovalItem[] = [
  {
    id: "1",
    type: "slack",
    title: "Product Launch Discussion",
    content:
      "We've decided to launch the new feature next Monday. The marketing team will prepare the announcement and the dev team needs to ensure all tests pass by Friday.",
    source: "#product-team",
    timestamp: new Date(Date.now() - 1000 * 60 * 30),
  },
  {
    id: "2",
    type: "meeting",
    title: "Q4 Planning Meeting",
    content:
      "Key decisions: 1) Increase focus on enterprise customers. 2) Hire 3 new engineers. 3) Launch mobile app by end of Q4. Budget approved for new infrastructure.",
    source: "Leadership Sync",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2),
  },
  {
    id: "3",
    type: "document",
    title: "Engineering Best Practices",
    content:
      "All new code must include unit tests with >80% coverage. PRs require at least 2 approvals. Deploy only on Tuesdays and Thursdays unless critical.",
    source: "Engineering Wiki",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24),
  },
];

const typeConfig = {
  slack: {
    icon: MessageSquare,
    label: "Slack Message",
    color: "bg-purple-500/10 text-purple-500",
  },
  meeting: {
    icon: Calendar,
    label: "Meeting Notes",
    color: "bg-blue-500/10 text-blue-500",
  },
  document: {
    icon: FileText,
    label: "Document",
    color: "bg-green-500/10 text-green-500",
  },
};

export function ApprovalCardStack() {
  const [items, setItems] = useState<ApprovalItem[]>(MOCK_ITEMS);
  const [exitDirection, setExitDirection] = useState<"left" | "right" | null>(
    null
  );
  const [isAnimating, setIsAnimating] = useState(false);

  const currentItem = items[0];

  const handleIrrelevant = () => {
    if (isAnimating) return;
    setExitDirection("left");
    setIsAnimating(true);

    setTimeout(() => {
      setExitDirection(null);
      setItems((prev) => prev.slice(1));
      setIsAnimating(false);
    }, 350);
  };

  const handleRelevant = () => {
    if (isAnimating) return;
    setExitDirection("right");
    setIsAnimating(true);

    // TODO: Save the approval
    console.log("Approved:", currentItem);

    setTimeout(() => {
      setExitDirection(null);
      setItems((prev) => prev.slice(1));
      setIsAnimating(false);
    }, 350);
  };

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center">
        <div className="rounded-full bg-green-500/10 p-4 mb-4">
          <Check className="size-8 text-green-500" />
        </div>
        <h3 className="text-lg font-semibold mb-2">All caught up!</h3>
        <p className="text-muted-foreground max-w-sm">
          You&apos;ve reviewed all pending knowledge entries. Check back later
          for new items.
        </p>
      </div>
    );
  }

  const config = typeConfig[currentItem.type];
  const Icon = config.icon;

  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[400px] gap-6">
      {/* Card Stack */}
      <div className="relative w-full max-w-lg">
        {/* Background cards for stack effect */}
        {items.length > 2 && (
          <Card className="absolute inset-0 min-h-[480px] translate-y-4 scale-[0.92] opacity-40 bg-card border" />
        )}
        {items.length > 1 && (
          <Card className="absolute inset-0 min-h-[480px] translate-y-2 scale-[0.96] opacity-60 bg-card border" />
        )}

        {/* Current card */}
        <Card
          key={currentItem.id}
          className={cn(
            "relative p-10 min-h-[480px] flex flex-col transition-all duration-300 ease-out overflow-hidden",
            exitDirection === "left" &&
              "-translate-x-[150%] -rotate-12 opacity-0",
            exitDirection === "right" &&
              "translate-x-[150%] rotate-12 opacity-0"
          )}
        >
          {/* Light gradient from top */}
          <div className="absolute inset-x-0 top-0 h-64 bg-gradient-to-b from-white/5 to-transparent pointer-events-none" />
          
          {/* Type badge */}
          <div className="flex items-center justify-between mb-6">
            <Badge variant="secondary" className={cn("gap-1.5", config.color)}>
              <Icon className="size-3.5" />
              {config.label}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {currentItem.timestamp.toLocaleDateString()}
            </span>
          </div>

          {/* Title */}
          <h3 className="text-2xl font-semibold mb-4">{currentItem.title}</h3>

          {/* Content */}
          <p className="text-base text-muted-foreground leading-relaxed flex-1">
            {currentItem.content}
          </p>

          {/* Source */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground pt-6 mt-6 border-t">
            <span>Source:</span>
            <span className="font-medium text-foreground">
              {currentItem.source}
            </span>
          </div>
        </Card>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="lg"
          onClick={handleIrrelevant}
          disabled={isAnimating}
          className="gap-2 min-w-[140px]"
        >
          <X className="size-4" />
          Irrelevant
        </Button>
        <Button
          size="lg"
          onClick={handleRelevant}
          disabled={isAnimating}
          className="gap-2 min-w-[140px]"
        >
          <Check className="size-4" />
          Relevant
        </Button>
      </div>
    </div>
  );
}

