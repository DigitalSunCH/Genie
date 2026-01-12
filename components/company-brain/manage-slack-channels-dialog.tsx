"use client";

import * as React from "react";
import { Loader2, Trash2, RefreshCw } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { AddSlackChannelDialog } from "./add-slack-channel-dialog";

function SlackIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zm1.271 0a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zm0 1.271a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zm-1.27 0a2.528 2.528 0 0 1-2.522 2.521 2.528 2.528 0 0 1-2.522-2.521V2.522A2.528 2.528 0 0 1 15.164 0a2.528 2.528 0 0 1 2.522 2.522v6.312zM15.164 18.956a2.528 2.528 0 0 1 2.522 2.522A2.528 2.528 0 0 1 15.164 24a2.528 2.528 0 0 1-2.522-2.522v-2.522h2.522zm0-1.27a2.528 2.528 0 0 1-2.522-2.522 2.528 2.528 0 0 1 2.522-2.522h6.314A2.528 2.528 0 0 1 24 15.164a2.528 2.528 0 0 1-2.522 2.522h-6.314z" />
    </svg>
  );
}

interface SlackChannel {
  id: string;
  slack_channel_id: string;
  slack_channel_name: string | null;
  created_at: string;
}

interface ManageSlackChannelsDialogProps {
  channels: SlackChannel[];
  isLoading: boolean;
  onChannelAdded: () => void;
  onChannelRemoved: (channelId: string) => void;
}

export function ManageSlackChannelsDialog({
  channels,
  isLoading,
  onChannelAdded,
  onChannelRemoved,
}: ManageSlackChannelsDialogProps) {
  const [open, setOpen] = React.useState(false);
  const [syncingChannelId, setSyncingChannelId] = React.useState<string | null>(null);

  const channelCount = channels.length;

  const handleResync = async (channelId: string) => {
    setSyncingChannelId(channelId);
    try {
      const response = await fetch(`/api/slack/channels/${channelId}/sync`, {
        method: "POST",
      });
      
      if (!response.ok) {
        const data = await response.json();
        console.error("Sync failed:", data.error);
      }
    } catch (error) {
      console.error("Sync error:", error);
    } finally {
      setSyncingChannelId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="rounded-full font-bold">
          <SlackIcon className="size-4" />
          {isLoading
            ? "Loading..."
            : `${channelCount} channel${channelCount !== 1 ? "s" : ""}`}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Connected Slack Channels</DialogTitle>
          <DialogDescription>
            Manage the Slack channels connected to your Company Brain.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : channels.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p className="mb-4">No channels connected yet.</p>
              <AddSlackChannelDialog onChannelAdded={onChannelAdded} />
            </div>
          ) : (
            <ScrollArea className="max-h-[300px]">
              <div className="space-y-2">
                {channels.map((channel) => (
                  <div
                    key={channel.id}
                    className="flex items-center justify-between rounded-md border bg-card p-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex size-8 items-center justify-center rounded-md bg-primary/10">
                        <SlackIcon className="size-4 text-primary" />
                      </div>
                      <div>
                        <div className="font-medium text-sm">
                          #{channel.slack_channel_name || channel.slack_channel_id}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Added {new Date(channel.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => handleResync(channel.id)}
                              disabled={syncingChannelId === channel.id}
                              className="text-muted-foreground hover:text-primary"
                            >
                              {syncingChannelId === channel.id ? (
                                <Loader2 className="size-4 animate-spin" />
                              ) : (
                                <RefreshCw className="size-4" />
                              )}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Re-sync messages</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => onChannelRemoved(channel.id)}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>

        {channels.length > 0 && (
          <div className="flex justify-end">
            <AddSlackChannelDialog onChannelAdded={onChannelAdded} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

