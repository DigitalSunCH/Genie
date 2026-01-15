"use client";

import * as React from "react";
import { Hash, Loader2, Lock, Plus, CheckCircle, Search } from "lucide-react";
import { useOrganization } from "@clerk/nextjs";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface SlackChannel {
  id: string;
  name: string;
  is_private: boolean;
  num_members: number;
}

interface AddSlackChannelDialogProps {
  onChannelAdded?: () => void;
  connectedChannelIds?: string[];
}

type SyncStatus = "idle" | "adding" | "syncing" | "complete" | "error";

export function AddSlackChannelDialog({
  onChannelAdded,
  connectedChannelIds = [],
}: AddSlackChannelDialogProps) {
  const { organization } = useOrganization();
  const [open, setOpen] = React.useState(false);
  const [channels, setChannels] = React.useState<SlackChannel[]>([]);
  const [selectedChannel, setSelectedChannel] = React.useState<string>("");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [syncStatus, setSyncStatus] = React.useState<SyncStatus>("idle");
  const [syncStats, setSyncStats] = React.useState<{
    recordsUpserted?: number;
    threadsProcessed?: number;
  } | null>(null);

  const fetchChannels = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/slack/channels");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch channels");
      }

      setChannels(data.channels);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load channels");
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (open) {
      fetchChannels();
      setSelectedChannel("");
      setSearchQuery("");
    }
  }, [open, fetchChannels]);

  // Filter channels based on search query
  const filteredChannels = React.useMemo(() => {
    if (!searchQuery.trim()) return channels;
    const query = searchQuery.toLowerCase();
    return channels.filter((channel) =>
      channel.name.toLowerCase().includes(query)
    );
  }, [channels, searchQuery]);

  const handleSubmit = async () => {
    if (!selectedChannel || !organization) return;

    const channel = channels.find((c) => c.id === selectedChannel);
    if (!channel) return;

    setIsSubmitting(true);
    setError(null);
    setSyncStatus("adding");
    setSyncStats(null);

    try {
      // Step 1: Add channel to database
      const addResponse = await fetch("/api/slack/channels/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channelId: channel.id,
          channelName: channel.name,
        }),
      });

      const addData = await addResponse.json();

      if (!addResponse.ok) {
        throw new Error(addData.error || "Failed to add channel");
      }

      // Step 2: Sync messages to Pinecone
      setSyncStatus("syncing");
      
      const syncResponse = await fetch(`/api/slack/channels/${addData.channel.id}/sync`, {
        method: "POST",
      });

      const syncData = await syncResponse.json();

      if (!syncResponse.ok) {
        // Channel was added but sync failed - show warning but don't fail completely
        console.error("Sync failed:", syncData.error);
        setSyncStatus("error");
        setError(`Channel added but sync failed: ${syncData.error}. You can try syncing again later.`);
        onChannelAdded?.();
        return;
      }

      // Success!
      setSyncStatus("complete");
      setSyncStats({
        recordsUpserted: syncData.stats?.recordsUpserted,
        threadsProcessed: syncData.stats?.threadsProcessed,
      });

      // Wait a moment to show success, then close
      setTimeout(() => {
        setOpen(false);
        onChannelAdded?.();
        // Reset state after dialog closes
        setTimeout(() => {
          setSyncStatus("idle");
          setSyncStats(null);
        }, 300);
      }, 2000);
    } catch (err) {
      setSyncStatus("error");
      setError(err instanceof Error ? err.message : "Failed to add channel");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="size-4" />
          Add Slack Channel
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Slack Channel</DialogTitle>
          <DialogDescription>
            Select a Slack channel to connect to your Company Brain.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {syncStatus === "syncing" || syncStatus === "adding" ? (
            <div className="flex flex-col items-center justify-center py-8 space-y-4">
              <Loader2 className="size-8 animate-spin text-primary" />
              <div className="text-center">
                <p className="font-medium">
                  {syncStatus === "adding" ? "Adding channel..." : "Syncing messages to Company Brain..."}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {syncStatus === "syncing" && "This may take a moment for channels with many messages."}
                </p>
              </div>
            </div>
          ) : syncStatus === "complete" ? (
            <div className="flex flex-col items-center justify-center py-8 space-y-4">
              <div className="flex size-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                <CheckCircle className="size-6 text-green-600 dark:text-green-400" />
              </div>
              <div className="text-center">
                <p className="font-medium text-green-600 dark:text-green-400">
                  Channel synced successfully!
                </p>
                {syncStats && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {syncStats.recordsUpserted} messages indexed
                    {syncStats.threadsProcessed ? ` (${syncStats.threadsProcessed} threads)` : ""}
                  </p>
                )}
              </div>
            </div>
          ) : isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          ) : channels.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No channels found. Make sure the Slack bot is added to your
              workspace.
            </div>
          ) : (
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  placeholder="Search channels..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <ScrollArea className="h-[250px] rounded-md border">
                <div className="p-1">
                  {filteredChannels.length === 0 ? (
                    <div className="py-6 text-center text-sm text-muted-foreground">
                      No channels found.
                    </div>
                  ) : (
                    filteredChannels.map((channel) => {
                      const isConnected = connectedChannelIds.includes(channel.id);
                      return (
                        <button
                          key={channel.id}
                          onClick={() => !isConnected && setSelectedChannel(channel.id)}
                          disabled={isConnected}
                          className={cn(
                            "w-full flex items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors",
                            isConnected
                              ? "opacity-50 cursor-not-allowed"
                              : selectedChannel === channel.id
                                ? "bg-primary text-primary-foreground"
                                : "hover:bg-muted"
                          )}
                        >
                          {channel.is_private ? (
                            <Lock className={cn(
                              "size-4",
                              !isConnected && selectedChannel === channel.id ? "text-primary-foreground" : "text-muted-foreground"
                            )} />
                          ) : (
                            <Hash className={cn(
                              "size-4",
                              !isConnected && selectedChannel === channel.id ? "text-primary-foreground" : "text-muted-foreground"
                            )} />
                          )}
                          <span className="flex-1 truncate">{channel.name}</span>
                          {isConnected ? (
                            <span className="text-xs text-muted-foreground">Added</span>
                          ) : (
                            <span className={cn(
                              "text-xs",
                              selectedChannel === channel.id ? "text-primary-foreground/70" : "text-muted-foreground"
                            )}>
                              {channel.num_members} members
                            </span>
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>

        {syncStatus !== "syncing" && syncStatus !== "adding" && syncStatus !== "complete" && (
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!selectedChannel || isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Adding...
                </>
              ) : (
                "Add Channel"
              )}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ChannelPreview({ channel }: { channel: SlackChannel }) {
  return (
    <div className="mt-3 flex items-center gap-3 rounded-md border bg-muted/50 p-3">
      <div className="flex size-10 items-center justify-center rounded-md bg-primary/10">
        {channel.is_private ? (
          <Lock className="size-5 text-primary" />
        ) : (
          <Hash className="size-5 text-primary" />
        )}
      </div>
      <div>
        <div className="font-medium">{channel.name}</div>
        <div className="text-xs text-muted-foreground">
          {channel.num_members} members
        </div>
      </div>
    </div>
  );
}

