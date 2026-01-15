import { NextResponse } from "next/server";
import { slackClient } from "@/lib/slack";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Cron secret for authorization
const CRON_SECRET = process.env.CRON_SECRET;

interface SlackMessage {
  ts: string;
  user?: string;
  text?: string;
  thread_ts?: string;
  type?: string;
  reply_count?: number;
}

interface SlackChannel {
  id: string;
  organization_id: string;
  slack_channel_id: string;
  slack_channel_name: string | null;
  last_synced_message_ts: string | null;
}

interface ThreadReply {
  ts: string;
  user?: string;
  text?: string;
}

/**
 * Resolve Slack user mentions in text
 */
function resolveSlackMentions(
  text: string,
  usersMap: Record<string, string>
): string {
  let resolved = text;

  // Resolve user mentions: <@USERID>
  resolved = resolved.replace(/<@([A-Z0-9]+)(\|[^>]+)?>/g, (match, userId, displayName) => {
    if (displayName) {
      return `@${displayName.slice(1)}`;
    }
    return usersMap[userId] ? `@${usersMap[userId]}` : `@${userId}`;
  });

  // Resolve channel mentions: <#CHANNELID|channel-name>
  resolved = resolved.replace(/<#[A-Z0-9]+\|([^>]+)>/g, "#$1");

  // Clean up URL formatting
  resolved = resolved.replace(/<(https?:\/\/[^|>]+)\|([^>]+)>/g, "$2");
  resolved = resolved.replace(/<(https?:\/\/[^>]+)>/g, "$1");

  return resolved;
}

/**
 * GET /api/cron/sync-slack
 * Hourly cron job to sync new Slack messages to inbox for approval
 */
export async function GET(request: Request) {
  console.log("[sync-slack] Starting Slack sync job...");

  try {
    // Verify cron secret
    const authHeader = request.headers.get("authorization");
    if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const stats = {
      channelsProcessed: 0,
      messagesFound: 0,
      inboxItemsCreated: 0,
      errors: [] as string[],
    };

    // Get all connected Slack channels
    console.log("[sync-slack] Fetching connected channels...");
    const { data: channels, error: channelsError } = await supabaseAdmin
      .from("slack_channels")
      .select("*");

    if (channelsError) {
      throw new Error(`Failed to fetch channels: ${channelsError.message}`);
    }

    if (!channels || channels.length === 0) {
      console.log("[sync-slack] No channels to sync");
      return NextResponse.json({
        success: true,
        message: "No channels to sync",
        stats,
      });
    }

    console.log(`[sync-slack] Found ${channels.length} channels to process`);

    // Process each channel
    for (const channel of channels as SlackChannel[]) {
      // Skip channels that haven't had initial sync yet
      if (!channel.last_synced_message_ts) {
        console.log(`[sync-slack] Skipping #${channel.slack_channel_name} - needs initial sync first`);
        continue;
      }

      try {
        const result = await processChannel(channel, stats);
        stats.channelsProcessed++;
        stats.messagesFound += result.messagesFound;
        stats.inboxItemsCreated += result.inboxItemsCreated;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        stats.errors.push(`Channel ${channel.slack_channel_name}: ${message}`);
        console.error(`[sync-slack] Error processing #${channel.slack_channel_name}:`, error);
      }
    }

    console.log("[sync-slack] Sync complete!", stats);
    return NextResponse.json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error("[sync-slack] Cron error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

async function processChannel(
  channel: SlackChannel,
  stats: { errors: string[] }
): Promise<{ messagesFound: number; inboxItemsCreated: number }> {
  console.log(`[sync-slack] Processing #${channel.slack_channel_name}...`);

  // Fetch only NEW messages since last sync
  const fetchOptions = {
    channel: channel.slack_channel_id,
    limit: 200,
    oldest: channel.last_synced_message_ts!,
  };

  let result;
  try {
    result = await slackClient.conversations.history(fetchOptions);
  } catch (error: unknown) {
    const slackError = error as { data?: { error?: string } };
    if (slackError.data?.error === "not_in_channel") {
      await slackClient.conversations.join({ channel: channel.slack_channel_id });
      result = await slackClient.conversations.history(fetchOptions);
    } else {
      throw error;
    }
  }

  if (!result.ok || !result.messages) {
    return { messagesFound: 0, inboxItemsCreated: 0 };
  }

  // Filter valid messages (skip the last synced message itself)
  const messages = (result.messages as SlackMessage[]).filter((msg) => {
    if (msg.type !== "message" || !msg.user || !msg.text) return false;
    if (msg.ts === channel.last_synced_message_ts) return false;
    return true;
  });

  if (messages.length === 0) {
    console.log(`[sync-slack] No new messages in #${channel.slack_channel_name}`);
    return { messagesFound: 0, inboxItemsCreated: 0 };
  }

  console.log(`[sync-slack] Found ${messages.length} new messages in #${channel.slack_channel_name}`);

  // Get user info for all messages
  const userIds = [...new Set(messages.map((m) => m.user!))];
  const usersMap: Record<string, string> = {};

  for (const userId of userIds) {
    try {
      const userResult = await slackClient.users.info({ user: userId });
      if (userResult.ok && userResult.user) {
        usersMap[userId] = userResult.user.real_name || userResult.user.name || userId;
      }
    } catch {
      usersMap[userId] = userId;
    }
  }

  // Fetch thread replies for messages with replies
  const messagesWithThreads = messages.filter((msg) => msg.reply_count && msg.reply_count > 0);
  const threadRepliesMap: Record<string, ThreadReply[]> = {};

  for (const msg of messagesWithThreads) {
    try {
      const threadResult = await slackClient.conversations.replies({
        channel: channel.slack_channel_id,
        ts: msg.ts,
        limit: 50,
      });

      if (threadResult.ok && threadResult.messages) {
        const replies = (threadResult.messages as ThreadReply[]).slice(1);
        threadRepliesMap[msg.ts] = replies;

        for (const reply of replies) {
          if (reply.user && !usersMap[reply.user]) {
            try {
              const userResult = await slackClient.users.info({ user: reply.user });
              if (userResult.ok && userResult.user) {
                usersMap[reply.user] = userResult.user.real_name || userResult.user.name || reply.user;
              }
            } catch {
              usersMap[reply.user] = reply.user;
            }
          }
        }
      }
    } catch (threadError) {
      console.error(`[sync-slack] Failed to fetch thread replies for ${msg.ts}:`, threadError);
    }
  }

  // Build ONE inbox item with ALL new messages bundled together
  const allMessageItems: Array<{ userName: string; text: string; timestamp: string }> = [];
  let latestTs: string | null = channel.last_synced_message_ts;
  const processedThreads = new Set<string>();

  // Sort messages oldest first
  const sortedMessages = messages.sort((a, b) => parseFloat(a.ts) - parseFloat(b.ts));

  for (const msg of sortedMessages) {
    // Skip if this is a reply to a thread we're already processing
    if (msg.thread_ts && msg.thread_ts !== msg.ts && processedThreads.has(msg.thread_ts)) {
      continue;
    }

    const hasThread = msg.reply_count && msg.reply_count > 0;
    const threadReplies = hasThread ? threadRepliesMap[msg.ts] || [] : [];

    if (hasThread && threadReplies.length > 0) {
      // Add thread starter
      const userName = usersMap[msg.user!] || msg.user!;
      const resolvedText = resolveSlackMentions(msg.text!, usersMap);
      allMessageItems.push({
        userName,
        text: resolvedText,
        timestamp: new Date(parseFloat(msg.ts) * 1000).toISOString(),
      });

      // Add thread replies
      for (const reply of threadReplies) {
        const replyUserName = usersMap[reply.user!] || reply.user!;
        const replyText = resolveSlackMentions(reply.text || "", usersMap);
        allMessageItems.push({
          userName: replyUserName,
          text: replyText,
          timestamp: new Date(parseFloat(reply.ts) * 1000).toISOString(),
        });
      }

      processedThreads.add(msg.ts);
    } else {
      // Single message
      const userName = usersMap[msg.user!] || msg.user!;
      const resolvedText = resolveSlackMentions(msg.text!, usersMap);
      allMessageItems.push({
        userName,
        text: resolvedText,
        timestamp: new Date(parseFloat(msg.ts) * 1000).toISOString(),
      });
    }

    // Track latest timestamp
    if (!latestTs || parseFloat(msg.ts) > parseFloat(latestTs)) {
      latestTs = msg.ts;
    }
  }

  // Create ONE inbox item with all messages
  const title = `${allMessageItems.length} new message${allMessageItems.length !== 1 ? "s" : ""} in #${channel.slack_channel_name}`;
  const summary = allMessageItems
    .map((m) => `**${m.userName}:** ${m.text}`)
    .join("\n\n");

  await supabaseAdmin.from("inbox_items").insert({
    organization_id: channel.organization_id,
    type: "topic",
    title,
    summary,
    source_data: {
      channelId: channel.slack_channel_id,
      channelName: channel.slack_channel_name,
      messageCount: allMessageItems.length,
      messages: allMessageItems,
      latestTs,
    },
    status: "pending",
  });

  // Update last synced timestamp
  if (latestTs && latestTs !== channel.last_synced_message_ts) {
    await supabaseAdmin
      .from("slack_channels")
      .update({
        last_synced_message_ts: latestTs,
        last_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", channel.id);
  }

  console.log(`[sync-slack] Created 1 inbox item with ${allMessageItems.length} messages for #${channel.slack_channel_name}`);
  return { messagesFound: messages.length, inboxItemsCreated: 1 };
}
