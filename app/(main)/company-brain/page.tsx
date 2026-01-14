"use client";

import * as React from "react";
import { Brain, MessageSquare, Inbox } from "lucide-react";
import { useOrganization } from "@clerk/nextjs";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

import PageHeader from "@/components/common/page-header";
import { ManageSlackChannelsDialog } from "@/components/company-brain/manage-slack-channels-dialog";
import { ManageDriveFoldersDialog } from "@/components/company-brain/manage-drive-folders-dialog";
import { ManageUploadedFilesDialog } from "@/components/company-brain/manage-uploaded-files-dialog";
import { ManageGmailAddressesDialog } from "@/components/company-brain/manage-gmail-addresses-dialog";
import { ManageTldvDialog } from "@/components/company-brain/manage-tldv-dialog";
import { BrainChat } from "@/components/company-brain/brain-chat";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  const { organization } = useOrganization();
  const searchParams = useSearchParams();
  const [mounted, setMounted] = React.useState(false);
  const [channels, setChannels] = React.useState<SlackChannel[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [tldvMeetings, setTldvMeetings] = React.useState<TldvMeeting[]>([]);
  const [isTldvLoading, setIsTldvLoading] = React.useState(true);

  // Handle hydration mismatch by only reading searchParams after mount
  React.useEffect(() => {
    setMounted(true);
  }, []);

  const chatId = mounted ? searchParams.get("chat") : null;

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
  }, [fetchConnectedChannels, fetchTldvMeetings]);

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
            <Tabs value="chat">
              <TabsList>
                <TabsTrigger value="chat" className="gap-1.5" asChild>
                  <Link href="/company-brain">
                    <MessageSquare className="size-4" />
                    Chat
                  </Link>
                </TabsTrigger>
                <TabsTrigger value="inbox" className="gap-1.5" asChild>
                  <Link href="/company-brain/inbox">
                    <Inbox className="size-4" />
                    Inbox
                    <Badge variant="default" className="h-5 min-w-6 px-1.5 rounded-md">
                      3
                    </Badge>
                  </Link>
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
              <ManageDriveFoldersDialog />
              <ManageGmailAddressesDialog />
              <ManageUploadedFilesDialog />
            </div>
          </div>

          {/* Main Content Area */}
          <div className="flex flex-1 gap-4 overflow-hidden mt-0">
            <BrainChat chatId={chatId} />
          </div>
        </Card>
      </div>
    </>
  );
}
