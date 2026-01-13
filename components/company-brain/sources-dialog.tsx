"use client";

import * as React from "react";
import { Hash, ExternalLink, MessageCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

export interface Source {
  type: "slack";
  channelName: string;
  userName: string;
  timestamp: string;
  text: string;
  slackLink: string;
  isThread: boolean;
}

interface SourcesDialogProps {
  sources: Source[];
}

function groupSourcesByChannel(sources: Source[]): Record<string, Source[]> {
  const grouped: Record<string, Source[]> = {};
  for (const source of sources) {
    if (!grouped[source.channelName]) {
      grouped[source.channelName] = [];
    }
    grouped[source.channelName].push(source);
  }
  return grouped;
}

function formatSourceDate(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function truncateText(text: string, maxLength: number = 150): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + "...";
}

export function SourcesDialog({ sources }: SourcesDialogProps) {
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

