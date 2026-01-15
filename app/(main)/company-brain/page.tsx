"use client";

import * as React from "react";
import { Suspense } from "react";
import { Brain, MessageSquare, Inbox, RefreshCw } from "lucide-react";
import { useOrganization } from "@clerk/nextjs";
import { useSearchParams } from "next/navigation";

import PageHeader from "@/components/common/page-header";
import { ManageSlackChannelsDialog } from "@/components/company-brain/manage-slack-channels-dialog";
import { ManageTldvDialog } from "@/components/company-brain/manage-tldv-dialog";
import { BrainChat } from "@/components/company-brain/brain-chat";
import { InboxCardStack } from "@/components/company-brain/inbox-card-stack";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface SlackChannel {
  id: string;
  slack_channel_id: string;
  slack_channel_name: string | null;
  created_at: string;
}

interface TldvMeeting {
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

export default function CompanyBrainPage() {
  return (
    <Suspense fallback={null}>
      <CompanyBrainContent />
    </Suspense>
  );
}

function CompanyBrainContent() {
  const { organization } = useOrganization();
  const searchParams = useSearchParams();
  const [mounted, setMounted] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<"chat" | "inbox">("chat");
  const [channels, setChannels] = React.useState<SlackChannel[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [tldvMeetings, setTldvMeetings] = React.useState<TldvMeeting[]>([]);
  const [isTldvLoading, setIsTldvLoading] = React.useState(true);
  const [inboxCount, setInboxCount] = React.useState(0);
  const [isSyncing, setIsSyncing] = React.useState(false);

  // Handle hydration mismatch by only reading searchParams after mount
  React.useEffect(() => {
    setMounted(true);
  }, []);

  const chatId = mounted ? searchParams.get("chat") : null;

  // Fetch inbox count
  const fetchInboxCount = React.useCallback(async () => {
    if (!organization) return;
    try {
      const response = await fetch("/api/company-brain/inbox");
      const data = await response.json();
      if (response.ok) {
        setInboxCount(data.count || 0);
      }
    } catch (error) {
      console.error("Failed to fetch inbox count:", error);
    }
  }, [organization]);

  const fetchConnectedChannels = React.useCallback(async () => {
    if (!organization) return;

    try {
      const response = await fetch("/api/slack/channels/connected");
      const data = await response.json();

      if (response.ok) {
        setChannels(data.channels || []);
      }
    } catch (error) {
      console.error("Failed to fetch connected channels:", error);
    } finally {
      setIsLoading(false);
    }
  }, [organization]);

  const fetchTldvMeetings = React.useCallback(async () => {
    if (!organization) return;

    try {
      const response = await fetch("/api/tldv/meetings");
      const data = await response.json();

      if (response.ok) {
        setTldvMeetings(data.meetings || []);
      }
    } catch (error) {
      console.error("Failed to fetch tldv meetings:", error);
    } finally {
      setIsTldvLoading(false);
    }
  }, [organization]);

  React.useEffect(() => {
    fetchConnectedChannels();
    fetchTldvMeetings();
    fetchInboxCount();
  }, [fetchConnectedChannels, fetchTldvMeetings, fetchInboxCount]);

  const handleRemoveChannel = async (channelId: string) => {
    try {
      const response = await fetch(`/api/slack/channels/${channelId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        fetchConnectedChannels();
      }
    } catch (error) {
      console.error("Failed to remove channel:", error);
    }
  };

  const handleAddTldvMeeting = async (url: string) => {
    const response = await fetch("/api/tldv/meetings/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || "Failed to add meeting");
    }

    await fetchTldvMeetings();
  };

  const handleRemoveTldvMeeting = async (meetingId: string) => {
    const response = await fetch(`/api/tldv/meetings/${meetingId}`, {
      method: "DELETE",
    });

    if (response.ok) {
      await fetchTldvMeetings();
    }
  };

  const handleSyncAll = async () => {
    setIsSyncing(true);
    try {
      // Trigger both cron jobs in parallel
      await Promise.all([
        fetch("/api/cron/sync-slack"),
        fetch("/api/cron/sync-tldv"),
      ]);
      // Refresh the data after sync
      await Promise.all([
        fetchConnectedChannels(),
        fetchTldvMeetings(),
        fetchInboxCount(),
      ]);
    } catch (error) {
      console.error("Sync error:", error);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <>
      <PageHeader
        titleUrl="/company-brain"
        title="Company Brain"
        icon={<Brain className="size-4" />}
      />
      {/* Fixed height container - no PageLayout to avoid flex-grow issues */}
      <div className="flex flex-col p-4 pt-0 h-[calc(100vh-3.5rem)] overflow-hidden">
        <Card className="flex flex-col flex-1 p-6 border-0 shadow-none bg-muted/40 overflow-hidden">
          {/* Top Bar - Fixed height */}
          <div className="flex items-center justify-between flex-shrink-0">
            {/* Left: Tabs */}
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "chat" | "inbox")}>
              <TabsList>
                <TabsTrigger value="chat" className="gap-1.5">
                  <MessageSquare className="size-4" />
                  Chat
                </TabsTrigger>
                <TabsTrigger value="inbox" className="gap-1.5">
                  <Inbox className="size-4" />
                  Inbox
                  {inboxCount > 0 && (
                    <Badge variant="default" className="h-5 min-w-6 px-1.5 rounded-md">
                      {inboxCount}
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Right: Data Source Buttons */}
            <div className="flex items-center gap-2">
              <ManageSlackChannelsDialog
                channels={channels}
                isLoading={isLoading}
                onChannelAdded={fetchConnectedChannels}
                onChannelRemoved={handleRemoveChannel}
              />
              <ManageTldvDialog
                meetings={tldvMeetings}
                isLoading={isTldvLoading}
                onMeetingAdded={handleAddTldvMeeting}
                onMeetingRemoved={handleRemoveTldvMeeting}
              />
              <Button
                variant="outline"
                size="sm"
                className="rounded-full"
                onClick={handleSyncAll}
                disabled={isSyncing}
              >
                <RefreshCw className={`size-4 ${isSyncing ? "animate-spin" : ""}`} />
                {isSyncing ? "Syncing..." : "Sync"}
              </Button>
            </div>
          </div>

          {/* Main Content Area */}
          <div className="flex flex-1 gap-4 overflow-hidden mt-0">
            {activeTab === "chat" ? (
              <BrainChat chatId={chatId} />
            ) : (
              <div className="flex flex-1 items-center justify-center">
                <InboxCardStack 
                  onCountChange={setInboxCount} 
                  onApprove={() => {
                    // Refresh data sources when an item is approved
                    fetchTldvMeetings();
                    fetchConnectedChannels();
                  }}
                />
              </div>
            )}
          </div>
        </Card>
      </div>
    </>
  );
}
