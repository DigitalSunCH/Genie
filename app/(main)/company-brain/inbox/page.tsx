"use client";

import * as React from "react";
import { Brain, MessageSquare, Inbox } from "lucide-react";
import { useOrganization } from "@clerk/nextjs";
import Link from "next/link";

import PageHeader from "@/components/common/page-header";
import { ManageSlackChannelsDialog } from "@/components/company-brain/manage-slack-channels-dialog";
import { ManageDriveFoldersDialog } from "@/components/company-brain/manage-drive-folders-dialog";
import { ManageUploadedFilesDialog } from "@/components/company-brain/manage-uploaded-files-dialog";
import { ManageGmailAddressesDialog } from "@/components/company-brain/manage-gmail-addresses-dialog";
import { ManageTldvDialog } from "@/components/company-brain/manage-tldv-dialog";
import { InboxCardStack } from "@/components/company-brain/inbox-card-stack";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface SlackChannel {
  id: string;
  slack_channel_id: string;
  slack_channel_name: string | null;
  created_at: string;
}

export default function CompanyBrainInboxPage() {
  const { organization } = useOrganization();
  const [channels, setChannels] = React.useState<SlackChannel[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

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

  React.useEffect(() => {
    fetchConnectedChannels();
  }, [fetchConnectedChannels]);

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
            <Tabs value="inbox">
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
              <ManageTldvDialog />
              <ManageDriveFoldersDialog />
              <ManageGmailAddressesDialog />
              <ManageUploadedFilesDialog />
            </div>
          </div>

          {/* Main Content Area */}
          <div className="flex flex-1 items-center justify-center overflow-hidden mt-2">
            <InboxCardStack />
          </div>
        </Card>
      </div>
    </>
  );
}

