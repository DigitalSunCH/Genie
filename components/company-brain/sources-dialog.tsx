"use client";

import * as React from "react";
import Image from "next/image";
import { Hash, ExternalLink, MessageCircle, Video, Clock, Globe } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

export interface SlackSource {
  type: "slack";
  channelName: string;
  userName: string;
  timestamp: string;
  text: string;
  slackLink: string;
  isThread: boolean;
}

export interface TldvSource {
  type: "tldv";
  meetingTitle: string;
  speaker?: string;
  timestamp: string;
  text: string;
  tldvUrl?: string;
  startTime?: number;
  endTime?: number;
}

export interface WebSource {
  type: "web";
  title: string;
  url: string;
  content: string;
}

export type Source = SlackSource | TldvSource | WebSource;

interface SourcesDialogProps {
  sources: Source[];
}

function groupSlackSourcesByChannel(sources: SlackSource[]): Record<string, SlackSource[]> {
  const grouped: Record<string, SlackSource[]> = {};
  for (const source of sources) {
    if (!grouped[source.channelName]) {
      grouped[source.channelName] = [];
    }
    grouped[source.channelName].push(source);
  }
  return grouped;
}

function groupTldvSourcesByMeeting(sources: TldvSource[]): Record<string, TldvSource[]> {
  const grouped: Record<string, TldvSource[]> = {};
  for (const source of sources) {
    if (!grouped[source.meetingTitle]) {
      grouped[source.meetingTitle] = [];
    }
    grouped[source.meetingTitle].push(source);
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

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function truncateText(text: string, maxLength: number = 150): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + "...";
}

// Slack Sources Dialog
function SlackSourcesDialog({ sources }: { sources: SlackSource[] }) {
  const groupedSources = groupSlackSourcesByChannel(sources);
  const channelCount = Object.keys(groupedSources).length;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-7 gap-1.5 text-xs rounded-full px-3 bg-muted/50 border-border/50 hover:bg-muted"
        >
          <Image src="/slack.png" alt="Slack" width={14} height={14} className="rounded-sm" />
          <span>{sources.length} source{sources.length !== 1 ? "s" : ""}</span>
          <span className="text-muted-foreground">
            from {channelCount} channel{channelCount !== 1 ? "s" : ""}
          </span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl w-[90vw] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Image src="/slack.png" alt="Slack" width={20} height={20} />
            Slack Sources
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

// tldv Sources Dialog
function TldvSourcesDialog({ sources }: { sources: TldvSource[] }) {
  const groupedSources = groupTldvSourcesByMeeting(sources);
  const meetingCount = Object.keys(groupedSources).length;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-7 gap-1.5 text-xs rounded-full px-3 bg-muted/50 border-border/50 hover:bg-muted"
        >
          <Image src="/tldv.png" alt="tl;dv" width={14} height={14} className="rounded-sm" />
          <span>{sources.length} source{sources.length !== 1 ? "s" : ""}</span>
          <span className="text-muted-foreground">
            from {meetingCount} meeting{meetingCount !== 1 ? "s" : ""}
          </span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl w-[90vw] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Image src="/tldv.png" alt="tl;dv" width={20} height={20} />
            Meeting Sources
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-4 pr-4">
            {Object.entries(groupedSources).map(([meetingTitle, meetingSources]) => (
              <div key={meetingTitle} className="space-y-2">
                <div className="flex items-center gap-1.5 text-sm font-medium sticky top-0 bg-background py-1">
                  <Video className="size-4 text-muted-foreground flex-shrink-0" />
                  <span className="truncate">{meetingTitle}</span>
                  <span className="text-xs text-muted-foreground font-normal flex-shrink-0">
                    ({meetingSources.length})
                  </span>
                </div>
                <div className="space-y-2">
                  {meetingSources.map((source, index) => {
                    const hasTimeRange = source.startTime !== undefined && source.endTime !== undefined;
                    return (
                      <a
                        key={index}
                        href={source.tldvUrl || "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group block p-3 rounded-lg border border-border/50 hover:border-border hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0 overflow-hidden">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              {source.speaker && (
                                <span className="text-sm font-medium truncate">{source.speaker}</span>
                              )}
                              {hasTimeRange && (
                                <span className="flex items-center gap-1 text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded flex-shrink-0">
                                  <Clock className="size-3" />
                                  {formatTime(source.startTime!)}-{formatTime(source.endTime!)}
                                </span>
                              )}
                              <span className="text-xs text-muted-foreground flex-shrink-0">
                                {formatSourceDate(source.timestamp)}
                              </span>
                            </div>
                            <p className="text-sm text-muted-foreground break-words whitespace-pre-wrap">
                              {truncateText(source.text, 250)}
                            </p>
                          </div>
                          {source.tldvUrl && (
                            <ExternalLink className="size-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                          )}
                        </div>
                      </a>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

// Web Sources Dialog
function WebSourcesDialog({ sources }: { sources: WebSource[] }) {
  // Extract domain from URL for display
  const getDomain = (url: string) => {
    try {
      return new URL(url).hostname.replace("www.", "");
    } catch {
      return url;
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-7 gap-1.5 text-xs rounded-full px-3 bg-muted/50 border-border/50 hover:bg-muted"
        >
          <Globe className="size-3.5 text-muted-foreground" />
          <span>{sources.length} web source{sources.length !== 1 ? "s" : ""}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl w-[90vw] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="size-5" />
            Web Sources
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-2 pr-4">
            {sources.map((source, index) => (
              <a
                key={index}
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group block p-3 rounded-lg border border-border/50 hover:border-border hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0 overflow-hidden">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-sm font-medium truncate">{source.title}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mb-1.5 truncate">
                      {getDomain(source.url)}
                    </p>
                    <p className="text-sm text-muted-foreground break-words whitespace-pre-wrap">
                      {truncateText(source.content, 250)}
                    </p>
                  </div>
                  <ExternalLink className="size-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                </div>
              </a>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

// Main component - renders separate buttons for each source type
export function SourcesDialog({ sources }: SourcesDialogProps) {
  const slackSources = sources.filter((s): s is SlackSource => s.type === "slack");
  const tldvSources = sources.filter((s): s is TldvSource => s.type === "tldv");
  const webSources = sources.filter((s): s is WebSource => s.type === "web");

  return (
    <div className="flex items-center gap-2 mt-3 flex-wrap">
      {slackSources.length > 0 && <SlackSourcesDialog sources={slackSources} />}
      {tldvSources.length > 0 && <TldvSourcesDialog sources={tldvSources} />}
      {webSources.length > 0 && <WebSourcesDialog sources={webSources} />}
    </div>
  );
}
