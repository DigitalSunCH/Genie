"use client";

import * as React from "react";
import { Hash, Loader2, Lock, Plus, CheckCircle } from "lucide-react";
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

interface SlackChannel {
  id: string;
  name: string;
  is_private: boolean;
  num_members: number;
}

interface AddSlackChannelDialogProps {
  onChannelAdded?: () => void;
}

type SyncStatus = "idle" | "adding" | "syncing" | "complete" | "error";

export function AddSlackChannelDialog({
  onChannelAdded,
}: AddSlackChannelDialogProps) {
  const { organization } = useOrganization();
  const [open, setOpen] = React.useState(false);
  const [channels, setChannels] = React.useState<SlackChannel[]>([]);
  const [selectedChannel, setSelectedChannel] = React.useState<string>("");
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
    }
  }, [open, fetchChannels]);

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
            <div className="space-y-2">
              <label className="text-sm font-medium">Channel</label>
              <div className="relative">
                <select
                  value={selectedChannel}
                  onChange={(e) => setSelectedChannel(e.target.value)}
                  className="w-full h-10 px-3 pr-8 rounded-md border border-input bg-background text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 appearance-none cursor-pointer"
                >
                  <option value="">Select a channel...</option>
                  {channels.map((channel) => (
                    <option key={channel.id} value={channel.id}>
                      {channel.is_private ? "🔒" : "#"} {channel.name}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                  <svg
                    className="size-4 text-muted-foreground"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </div>
              </div>
              {selectedChannel && (
                <ChannelPreview
                  channel={channels.find((c) => c.id === selectedChannel)!}
                />
              )}
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

