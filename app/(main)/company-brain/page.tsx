"use client";

import * as React from "react";
import { Brain, MessageSquare, Inbox } from "lucide-react";
import { useOrganization } from "@clerk/nextjs";
import { useSearchParams } from "next/navigation";

import PageHeader from "@/components/common/page-header";
import { ManageSlackChannelsDialog } from "@/components/company-brain/manage-slack-channels-dialog";
import { ManageDriveFoldersDialog } from "@/components/company-brain/manage-drive-folders-dialog";
import { ManageUploadedFilesDialog } from "@/components/company-brain/manage-uploaded-files-dialog";
import { ManageGmailAddressesDialog } from "@/components/company-brain/manage-gmail-addresses-dialog";
import { ManageTldvDialog } from "@/components/company-brain/manage-tldv-dialog";
import { BrainChat } from "@/components/company-brain/brain-chat";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface SlackChannel {
  id: string;
  slack_channel_id: string;
  slack_channel_name: string | null;
  created_at: string;
}

export default function CompanyBrainPage() {
  const { organization } = useOrganization();
  const searchParams = useSearchParams();
  const [mounted, setMounted] = React.useState(false);
  const [channels, setChannels] = React.useState<SlackChannel[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [activeTab, setActiveTab] = React.useState("chat");

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
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList>
                <TabsTrigger value="chat" className="gap-1.5">
                  <MessageSquare className="size-4" />
                  Chat
                </TabsTrigger>
                <TabsTrigger value="inbox" className="gap-1.5">
                  <Inbox className="size-4" />
                  Inbox
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
          {activeTab === "chat" ? (
            <div className="flex flex-1 gap-4 overflow-hidden mt-0">
              <BrainChat chatId={chatId} />
            </div>
          ) : (
            <div className="flex flex-1 gap-4 overflow-hidden mt-2">
              <Card className="flex flex-col flex-1 overflow-hidden relative">
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center text-muted-foreground">
                    <div className="rounded-full bg-primary/10 p-4 mb-4 mx-auto w-fit">
                      <Inbox className="size-8 text-primary" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2 text-foreground">
                      Inbox
                    </h3>
                    <p className="max-w-sm">
                      Review and approve suggested knowledge from your connected
                      channels.
                    </p>
                  </div>
                </div>
              </Card>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
