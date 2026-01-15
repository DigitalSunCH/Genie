import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { slackClient } from "@/lib/slack";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  upsertSlackMessages,
  generateRecordId,
  SlackMessageRecord,
} from "@/lib/pinecone";

// Max characters to store per record (roughly ~800 tokens to stay under reranker limit)
const MAX_TEXT_LENGTH = 3000;

/**
 * Truncate text to max length, preserving word boundaries
 */
function truncateText(text: string, maxLength: number = MAX_TEXT_LENGTH): string {
  if (text.length <= maxLength) return text;
  
  // Find the last space before the limit
  const truncated = text.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(" ");
  
  if (lastSpace > maxLength * 0.8) {
    return truncated.slice(0, lastSpace) + "...";
  }
  return truncated + "...";
}

/**
 * Resolve Slack user mentions, channel mentions, and special mentions in text
 * Converts <@USERID> to @UserName, <#CHANNELID|name> to #name, etc.
 */
function resolveSlackMentions(
  text: string, 
  usersMap: Record<string, { name: string; avatar: string }>
): string {
  let resolved = text;
  
  // Resolve user mentions: <@USERID> or <@USERID|display_name>
  resolved = resolved.replace(/<@([A-Z0-9]+)(\|[^>]+)?>/g, (match, userId, displayName) => {
    if (displayName) {
      // Use the display name if provided (remove leading |)
      return `@${displayName.slice(1)}`;
    }
    const user = usersMap[userId];
    return user ? `@${user.name}` : `@${userId}`;
  });
  
  // Resolve channel mentions: <#CHANNELID|channel-name>
  resolved = resolved.replace(/<#[A-Z0-9]+\|([^>]+)>/g, '#$1');
  
  // Resolve channel mentions without name: <#CHANNELID>
  resolved = resolved.replace(/<#([A-Z0-9]+)>/g, '#$1');
  
  // Resolve user group mentions: <!subteam^GROUPID|@group-name>
  resolved = resolved.replace(/<!subteam\^[A-Z0-9]+\|(@[^>]+)>/g, '$1');
  
  // Resolve special mentions
  resolved = resolved.replace(/<!here>/g, '@here');
  resolved = resolved.replace(/<!channel>/g, '@channel');
  resolved = resolved.replace(/<!everyone>/g, '@everyone');
  
  // Clean up URL formatting: <http://url|display> -> display (or just url if no display)
  resolved = resolved.replace(/<(https?:\/\/[^|>]+)\|([^>]+)>/g, '$2 ($1)');
  resolved = resolved.replace(/<(https?:\/\/[^>]+)>/g, '$1');
  
  return resolved;
}

interface SlackMessage {
  ts: string;
  user?: string;
  text?: string;
  thread_ts?: string;
  reply_count?: number;
  type?: string;
}

interface ThreadReply {
  ts: string;
  user?: string;
  text?: string;
}

interface UserInfo {
  name: string;
  avatar: string;
}

/**
 * POST /api/slack/channels/[id]/sync
 * Syncs all messages from a Slack channel to Pinecone
 */
export async function POST(
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

    // Fetch all messages from Slack (with pagination and auto-join if needed)
    const allMessages: SlackMessage[] = [];
    let cursor: string | undefined;

    // First, try to fetch messages (may need to join channel first)
    let hasJoined = false;
    
    while (true) {
      try {
        const result = await slackClient.conversations.history({
          channel: channel.slack_channel_id,
          limit: 200,
          cursor,
        });

        if (!result.ok) {
          throw new Error(result.error || "Failed to fetch messages");
        }

        if (result.messages) {
          allMessages.push(...(result.messages as SlackMessage[]));
        }

        if (!result.has_more || !result.response_metadata?.next_cursor) {
          break;
        }
        cursor = result.response_metadata.next_cursor;
      } catch (historyError: unknown) {
        const error = historyError as { data?: { error?: string } };
        
        // If bot is not in channel, try to join and retry
        if (error.data?.error === "not_in_channel" && !hasJoined) {
          try {
            await slackClient.conversations.join({ channel: channel.slack_channel_id });
            hasJoined = true;
            // Continue the loop to retry fetching
            continue;
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
    }

    // Filter to only include real messages with text
    const validMessages = allMessages.filter(
      (msg) => msg.type === "message" && msg.user && msg.text
    );

    // Collect all user IDs: message authors + mentioned users
    const authorIds = validMessages.map((msg) => msg.user!);
    
    // Extract mentioned user IDs from message text using regex
    const mentionedIds: string[] = [];
    for (const msg of validMessages) {
      if (msg.text) {
        const mentions = msg.text.match(/<@([A-Z0-9]+)/g);
        if (mentions) {
          mentionedIds.push(...mentions.map((m) => m.replace("<@", "")));
        }
      }
    }
    
    const allUserIds = [...new Set([...authorIds, ...mentionedIds])];
    const usersMap: Record<string, UserInfo> = {};
    
    // Fetch user info for all users (authors + mentioned)
    for (const userId of allUserIds) {
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

    // Fetch thread replies for messages with replies
    const messagesWithThreads = validMessages.filter(
      (msg) => msg.reply_count && msg.reply_count > 0
    );

    const threadRepliesMap: Record<string, ThreadReply[]> = {};
    
    for (const msg of messagesWithThreads) {
      try {
        const threadResult = await slackClient.conversations.replies({
          channel: channel.slack_channel_id,
          ts: msg.ts,
          limit: 100,
        });

        if (threadResult.ok && threadResult.messages) {
          // Skip the first message (it's the parent) and get replies
          const replies = (threadResult.messages as ThreadReply[]).slice(1);
          threadRepliesMap[msg.ts] = replies;

          // Add any new users from replies (authors + mentions)
          for (const reply of replies) {
            const replyUserIds: string[] = [];
            
            // Add reply author
            if (reply.user) {
              replyUserIds.push(reply.user);
            }
            
            // Extract mentioned users from reply text
            if (reply.text) {
              const mentions = reply.text.match(/<@([A-Z0-9]+)/g);
              if (mentions) {
                replyUserIds.push(...mentions.map((m) => m.replace("<@", "")));
              }
            }
            
            // Fetch info for any new users
            for (const userId of replyUserIds) {
              if (!usersMap[userId]) {
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
            }
          }
        }
      } catch (threadError) {
        console.error(`Failed to fetch thread replies for ${msg.ts}:`, threadError);
      }
    }

    // Create Pinecone records
    // Group messages: standalone messages OR combined threads
    const records: SlackMessageRecord[] = [];
    const processedThreads = new Set<string>();

    for (const msg of validMessages) {
      // Skip if this message is a reply in a thread we've already processed
      if (msg.thread_ts && msg.thread_ts !== msg.ts && processedThreads.has(msg.thread_ts)) {
        continue;
      }

      const hasThread = (msg.reply_count ?? 0) > 0;
      const threadReplies = hasThread ? threadRepliesMap[msg.ts] || [] : [];

      let combinedText: string;
      let participantUserIds: string[] = [msg.user!];

      if (hasThread && threadReplies.length > 0) {
        // Combine thread into single text with context
        const threadMessages = [
          `[${usersMap[msg.user!]?.name || msg.user}]: ${resolveSlackMentions(msg.text || "", usersMap)}`,
          ...threadReplies.map((reply) => {
            if (reply.user) {
              participantUserIds.push(reply.user);
            }
            return `[${usersMap[reply.user!]?.name || reply.user}]: ${resolveSlackMentions(reply.text || "", usersMap)}`;
          }),
        ];
        combinedText = threadMessages.join("\n\n");
        processedThreads.add(msg.ts);
      } else {
        combinedText = resolveSlackMentions(msg.text!, usersMap);
      }

      // Get the primary user info (thread starter for threads)
      const primaryUserId = msg.user!;
      const primaryUserName = usersMap[primaryUserId]?.name || primaryUserId;

      const timestampSeconds = parseFloat(msg.ts);
      const record: SlackMessageRecord = {
        _id: generateRecordId(channel.slack_channel_id, msg.thread_ts || msg.ts),
        text: truncateText(combinedText),
        channel_id: channel.slack_channel_id,
        channel_name: channel.slack_channel_name || channel.slack_channel_id,
        user_id: primaryUserId,
        user_name: primaryUserName,
        timestamp: new Date(timestampSeconds * 1000).toISOString(),
        timestamp_unix: Math.floor(timestampSeconds), // Unix epoch in seconds for filtering
        message_ts: msg.ts,
        thread_ts: msg.thread_ts,
        reply_count: msg.reply_count || 0,
        is_thread: hasThread && threadReplies.length > 0,
        organization_id: orgId,
      };

      records.push(record);
    }

    // Upsert records to Pinecone
    const { upsertedCount } = await upsertSlackMessages(orgId, records);

    // Find the latest message timestamp for tracking new messages
    let latestTs: string | null = null;
    for (const msg of validMessages) {
      if (!latestTs || parseFloat(msg.ts) > parseFloat(latestTs)) {
        latestTs = msg.ts;
      }
    }

    // Update last_synced_at and last_synced_message_ts in database
    await supabaseAdmin
      .from("slack_channels")
      .update({ 
        last_synced_at: new Date().toISOString(),
        last_synced_message_ts: latestTs,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    return NextResponse.json({
      success: true,
      stats: {
        totalMessages: allMessages.length,
        validMessages: validMessages.length,
        threadsProcessed: processedThreads.size,
        recordsUpserted: upsertedCount,
      },
      channel: {
        id: channel.id,
        name: channel.slack_channel_name,
        slack_channel_id: channel.slack_channel_id,
      },
    });
  } catch (error) {
    console.error("Error syncing Slack channel:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

