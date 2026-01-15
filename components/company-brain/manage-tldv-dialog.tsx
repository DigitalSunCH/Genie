"use client";

import * as React from "react";
import Image from "next/image";
import {
  Loader2,
  Video,
  Trash2,
  Plus,
  ExternalLink,
  Clock,
  Users,
  Mail,
  RefreshCw,
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

export interface TldvMeeting {
  id: string;
  meetingId: string;
  title: string;
  date: string;
  durationSeconds: number;
  chunkCount: number;
  tldvUrl: string;
  organizerName: string | null;
  organizerEmail: string | null;
  invitees: Array<{ name: string; email: string }>;
  createdAt: string;
}

interface MonitoredEmail {
  id: string;
  email: string;
  createdAt: string;
}

interface ManageTldvDialogProps {
  meetings?: TldvMeeting[];
  isLoading?: boolean;
  onMeetingAdded?: (url: string) => Promise<void>;
  onMeetingRemoved?: (meetingId: string) => Promise<void>;
}

/**
 * Format duration in seconds to human-readable string
 */
function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${mins}m`;
  }
  return `${mins}m`;
}

/**
 * Format date to readable string
 */
function formatDate(isoDate: string): string {
  const date = new Date(isoDate);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function ManageTldvDialog({
  meetings = [],
  isLoading = false,
  onMeetingAdded,
  onMeetingRemoved,
}: ManageTldvDialogProps) {
  const [open, setOpen] = React.useState(false);
  const [newUrl, setNewUrl] = React.useState("");
  const [isAdding, setIsAdding] = React.useState(false);
  const [addError, setAddError] = React.useState<string | null>(null);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  // Auto-sync / Monitored emails state
  const [monitoredEmails, setMonitoredEmails] = React.useState<MonitoredEmail[]>([]);
  const [isMonitoredLoading, setIsMonitoredLoading] = React.useState(false);
  const [newMonitoredEmail, setNewMonitoredEmail] = React.useState("");
  const [isAddingMonitored, setIsAddingMonitored] = React.useState(false);
  const [monitoredError, setMonitoredError] = React.useState<string | null>(null);
  const [deletingMonitoredId, setDeletingMonitoredId] = React.useState<string | null>(null);

  const meetingCount = meetings.length;

  const isValidTldvUrl = (url: string): boolean => {
    // Accept tldv.io URLs or raw meeting IDs (24 hex chars)
    return url.includes("tldv.io/app/meetings/") || /^[a-f0-9]{24}$/i.test(url.trim());
  };

  const isValidEmail = (email: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  };

  // Fetch monitored emails when dialog opens
  const fetchMonitoredEmails = React.useCallback(async () => {
    setIsMonitoredLoading(true);
    try {
      const response = await fetch("/api/tldv/monitored-emails");
      const data = await response.json();
      if (response.ok) {
        setMonitoredEmails(data.emails || []);
      }
    } catch (error) {
      console.error("Failed to fetch monitored emails:", error);
    } finally {
      setIsMonitoredLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (open) {
      fetchMonitoredEmails();
    }
  }, [open, fetchMonitoredEmails]);

  const handleAddMeeting = async () => {
    if (!newUrl.trim() || !isValidTldvUrl(newUrl)) return;

    setIsAdding(true);
    setAddError(null);
    try {
      await onMeetingAdded?.(newUrl.trim());
      setNewUrl("");
    } catch (error) {
      setAddError(error instanceof Error ? error.message : "Failed to add meeting");
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteMeeting = async (id: string) => {
    setDeletingId(id);
    try {
      await onMeetingRemoved?.(id);
    } finally {
      setDeletingId(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddMeeting();
    }
  };

  // Monitored email handlers
  const handleAddMonitoredEmail = async () => {
    if (!newMonitoredEmail.trim() || !isValidEmail(newMonitoredEmail)) return;

    setIsAddingMonitored(true);
    setMonitoredError(null);

    try {
      const response = await fetch("/api/tldv/monitored-emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: newMonitoredEmail.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to add email");
      }

      setMonitoredEmails((prev) => [data.email, ...prev]);
      setNewMonitoredEmail("");
    } catch (error) {
      setMonitoredError(error instanceof Error ? error.message : "Failed to add email");
    } finally {
      setIsAddingMonitored(false);
    }
  };

  const handleDeleteMonitoredEmail = async (id: string) => {
    setDeletingMonitoredId(id);
    try {
      const response = await fetch(`/api/tldv/monitored-emails/${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setMonitoredEmails((prev) => prev.filter((e) => e.id !== id));
      }
    } finally {
      setDeletingMonitoredId(null);
    }
  };

  const handleMonitoredKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddMonitoredEmail();
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="rounded-full">
          <Image src="/tldv.png" alt="tl;dv" width={16} height={16} />
          {isLoading
            ? "Loading..."
            : `${meetingCount} Meeting${meetingCount !== 1 ? "s" : ""}`}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>tl;dv Meeting Recordings</DialogTitle>
          <DialogDescription>
            Add meeting recordings from tl;dv to include their transcripts in your company brain.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="added" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="added" className="gap-1.5">
              <Video className="size-4" />
              Added
              {meetingCount > 0 && (
                <Badge variant="secondary" className="h-5 min-w-5 px-1.5 rounded-md">
                  {meetingCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="auto-sync" className="gap-1.5">
              <RefreshCw className="size-4" />
              Auto-Sync
              {monitoredEmails.length > 0 && (
                <Badge variant="secondary" className="h-5 min-w-5 px-1.5 rounded-md">
                  {monitoredEmails.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Added Meetings Tab */}
          <TabsContent value="added" className="mt-4">
            {/* Add new meeting input */}
            <div className="flex gap-2 mb-4">
              <Input
                type="url"
                placeholder="Paste tldv meeting URL..."
                value={newUrl}
                onChange={(e) => {
                  setNewUrl(e.target.value);
                  setAddError(null);
                }}
                onKeyDown={handleKeyDown}
                disabled={isAdding}
                className="flex-1"
              />
              <Button
                size="sm"
                onClick={handleAddMeeting}
                disabled={!newUrl.trim() || !isValidTldvUrl(newUrl) || isAdding}
              >
                {isAdding ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Plus className="size-4" />
                )}
                Add
              </Button>
            </div>

            {addError && (
              <div className="text-sm text-destructive mb-4 p-2 bg-destructive/10 rounded-md">
                {addError}
              </div>
            )}

            {isAdding && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4 p-3 bg-muted rounded-md">
                <Loader2 className="size-4 animate-spin" />
                <span>Processing transcript... This may take a moment.</span>
              </div>
            )}

            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              </div>
            ) : meetings.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Video className="size-12 mx-auto mb-4 opacity-50" />
                <p>No meetings added yet.</p>
                <p className="text-xs mt-1">
                  Paste a tl;dv meeting URL or browse by attendee email.
                </p>
              </div>
            ) : (
              <ScrollArea className="max-h-[300px]">
                <div className="space-y-3">
                  {meetings.map((meeting) => (
                    <div
                      key={meeting.id}
                      className="flex items-start justify-between rounded-md border bg-card p-3 gap-3"
                    >
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <div className="flex size-10 items-center justify-center rounded-md bg-muted shrink-0">
                          <Image src="/tldv.png" alt="tl;dv" width={20} height={20} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-sm truncate" title={meeting.title}>
                            {meeting.title}
                          </div>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-muted-foreground">
                            <span>{formatDate(meeting.date)}</span>
                            <span className="flex items-center gap-1">
                              <Clock className="size-3" />
                              {formatDuration(meeting.durationSeconds)}
                            </span>
                            <span className="flex items-center gap-1">
                              <Users className="size-3" />
                              {meeting.invitees.length + 1}
                            </span>
                            <span className="text-muted-foreground/60">
                              {meeting.chunkCount} chunks
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          asChild
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <a href={meeting.tldvUrl} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="size-4" />
                          </a>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleDeleteMeeting(meeting.id)}
                          disabled={deletingId === meeting.id}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          {deletingId === meeting.id ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <Trash2 className="size-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </TabsContent>

          {/* Auto-Sync Tab */}
          <TabsContent value="auto-sync" className="mt-4">
            <div className="mb-4 p-3 bg-muted/50 rounded-md">
              <p className="text-sm text-muted-foreground">
                Meetings from monitored emails will be automatically synced hourly and sent to your
                inbox for approval before being added to your company brain.
              </p>
            </div>

            {/* Add monitored email input */}
            <div className="flex gap-2 mb-4">
              <Input
                type="email"
                placeholder="Add email to monitor..."
                value={newMonitoredEmail}
                onChange={(e) => {
                  setNewMonitoredEmail(e.target.value);
                  setMonitoredError(null);
                }}
                onKeyDown={handleMonitoredKeyDown}
                disabled={isAddingMonitored}
                className="flex-1"
              />
              <Button
                size="sm"
                onClick={handleAddMonitoredEmail}
                disabled={
                  !newMonitoredEmail.trim() ||
                  !isValidEmail(newMonitoredEmail) ||
                  isAddingMonitored
                }
              >
                {isAddingMonitored ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Plus className="size-4" />
                )}
                Add
              </Button>
            </div>

            {monitoredError && (
              <div className="text-sm text-destructive mb-4 p-2 bg-destructive/10 rounded-md">
                {monitoredError}
              </div>
            )}

            {isMonitoredLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              </div>
            ) : monitoredEmails.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <RefreshCw className="size-12 mx-auto mb-4 opacity-50" />
                <p>No monitored emails yet.</p>
                <p className="text-xs mt-1">
                  Add email addresses to automatically sync meetings where they are an attendee.
                </p>
              </div>
            ) : (
              <ScrollArea className="max-h-[250px]">
                <div className="space-y-2">
                  {monitoredEmails.map((monitored) => (
                    <div
                      key={monitored.id}
                      className="flex items-center justify-between rounded-md border bg-card p-3 gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="flex size-8 items-center justify-center rounded-md bg-muted shrink-0">
                          <Mail className="size-4 text-muted-foreground" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-sm truncate">{monitored.email}</div>
                          <div className="text-xs text-muted-foreground">
                            Added {formatDate(monitored.createdAt)}
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleDeleteMonitoredEmail(monitored.id)}
                        disabled={deletingMonitoredId === monitored.id}
                        className="text-muted-foreground hover:text-destructive shrink-0"
                      >
                        {deletingMonitoredId === monitored.id ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Trash2 className="size-4" />
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
