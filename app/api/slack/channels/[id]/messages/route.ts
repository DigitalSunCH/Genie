import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { slackClient } from "@/lib/slack";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

interface SlackMessage {
  ts: string;
  user: string;
  text: string;
  timestamp: string;
  thread_ts?: string;
  reply_count?: number;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { orgId } = await auth();

    if (!orgId) {
      return NextResponse.json(
        { error: "Unauthorized - no organization selected" },
        { status: 401 }
      );
    }

    const { id } = await params;

    // Get the channel from database to verify ownership and get slack_channel_id
    const { data: channel, error: channelError } = await supabaseAdmin
      .from("slack_channels")
      .select("*")
      .eq("id", id)
      .eq("organization_id", orgId)
      .single();

    if (channelError || !channel) {
      return NextResponse.json(
        { error: "Channel not found" },
        { status: 404 }
      );
    }

    // Fetch messages from Slack (with auto-join if needed)
    let result;
    try {
      result = await slackClient.conversations.history({
        channel: channel.slack_channel_id,
        limit: 100,
      });
    } catch (historyError: unknown) {
      const error = historyError as { data?: { error?: string } };
      
      // If bot is not in channel, try to join and retry
      if (error.data?.error === "not_in_channel") {
        try {
          await slackClient.conversations.join({ channel: channel.slack_channel_id });
          result = await slackClient.conversations.history({
            channel: channel.slack_channel_id,
            limit: 100,
          });
        } catch (joinError) {
          console.error("Failed to join channel:", joinError);
          return NextResponse.json(
            { error: "Bot could not join the channel. Please invite the bot manually." },
            { status: 403 }
          );
        }
      } else {
        throw historyError;
      }
    }

    if (!result || !result.ok) {
      return NextResponse.json(
        { error: result?.error || "Failed to fetch messages" },
        { status: 500 }
      );
    }

    // Fetch user info for all unique users in messages
    const userIds = [...new Set(
      (result.messages || [])
        .filter((msg) => msg.user)
        .map((msg) => msg.user as string)
    )];

    const usersMap: Record<string, { name: string; avatar: string }> = {};
    
    // Batch fetch user info
    for (const userId of userIds) {
      try {
        const userResult = await slackClient.users.info({ user: userId });
        if (userResult.ok && userResult.user) {
          usersMap[userId] = {
            name: userResult.user.real_name || userResult.user.name || userId,
            avatar: userResult.user.profile?.image_48 || "",
          };
        }
      } catch {
        usersMap[userId] = { name: userId, avatar: "" };
      }
    }

    const messages: SlackMessage[] = (result.messages || [])
      .filter((msg) => msg.type === "message" && msg.user && msg.text)
      .map((msg) => ({
        ts: msg.ts!,
        user: msg.user!,
        userName: usersMap[msg.user!]?.name || msg.user!,
        userAvatar: usersMap[msg.user!]?.avatar || "",
        text: msg.text!,
        timestamp: new Date(parseFloat(msg.ts!) * 1000).toISOString(),
        thread_ts: msg.thread_ts,
        reply_count: msg.reply_count || 0,
      }));

    // Update last_synced_at
    await supabaseAdmin
      .from("slack_channels")
      .update({ last_synced_at: new Date().toISOString() })
      .eq("id", id);

    return NextResponse.json({
      messages,
      channel: {
        id: channel.id,
        name: channel.slack_channel_name,
        slack_channel_id: channel.slack_channel_id,
      },
    });
  } catch (error) {
    console.error("Error fetching Slack messages:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

