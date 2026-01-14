import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import Anthropic from "@anthropic-ai/sdk";
import { searchCompanyBrain, CompanyBrainSearchResult } from "@/lib/pinecone";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { formatTime } from "@/lib/tldv";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Define the search_company_brain tool
const tools: Anthropic.Tool[] = [
  {
    name: "search_company_brain",
    description:
      "Search the Company Brain knowledge base for relevant information from connected data sources like Slack channels, meetings, and documents. Use this when the user asks about internal discussions, decisions, projects, or company knowledge. You can filter by channel and time range.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "The search query to find relevant information",
        },
        channel_name: {
          type: "string",
          description: "Optional: Filter by specific Slack channel name (without #, e.g., 'engineering', 'general')",
        },
        start_date: {
          type: "string",
          description: "Optional: Start of time range in ISO format (e.g., '2026-01-06'). Use for queries like 'last week' or 'yesterday'",
        },
        end_date: {
          type: "string",
          description: "Optional: End of time range in ISO format (e.g., '2026-01-12'). Use for queries like 'last week' or 'yesterday'",
        },
      },
      required: ["query"],
    },
  },
];

const getSystemPrompt = () => {
  const today = new Date().toISOString().split('T')[0];
  return `You are the Company Brain assistant - an AI that helps users find and understand information from their company's connected data sources including Slack channels, tl;dv meeting recordings, and documents.

Today's date is ${today}.

When users ask questions about internal discussions, decisions, projects, team updates, or company knowledge:
1. Use the search_company_brain tool to find relevant information
2. For time-based queries like "last week", "yesterday", "this month", calculate the appropriate start_date and end_date
3. Synthesize the results into a clear, helpful answer
4. Always cite your sources:
   - For Slack: mention the channel name, who said it, and when
   - For meeting recordings: mention the meeting title, speaker, and timestamp in the recording

When you don't find relevant information, be honest and let the user know. For general questions not related to company knowledge, you can answer directly without searching.

Be conversational, helpful, and concise.`;
};

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

// Source type for tracking where information came from
interface SlackSource {
  type: "slack";
  channelName: string;
  userName: string;
  timestamp: string;
  text: string;
  slackLink: string;
  isThread: boolean;
}

interface TldvSource {
  type: "tldv";
  meetingTitle: string;
  speaker?: string;
  timestamp: string;
  text: string;
  tldvUrl?: string;
  startTime?: number;
  endTime?: number;
}

type Source = SlackSource | TldvSource;

export async function POST(request: Request) {
  try {
    const { orgId, userId } = await auth();

    if (!orgId || !userId) {
      return NextResponse.json(
        { error: "Unauthorized - no organization selected" },
        { status: 401 }
      );
    }

    const { messages, model, chatId, userMessage } = (await request.json()) as {
      messages: ChatMessage[];
      model?: string;
      chatId?: string;
      userMessage?: string; // The latest user message to save
    };

    if (!messages || messages.length === 0) {
      return NextResponse.json(
        { error: "Messages are required" },
        { status: 400 }
      );
    }

    // Track sources used during this request
    const sources: Source[] = [];

    // If we have a chatId, verify it belongs to the current organization and user has access
    if (chatId) {
      const { data: chat, error: chatError } = await supabaseAdmin
        .from("company_brain_chats")
        .select("id, created_by")
        .eq("id", chatId)
        .eq("organization_id", orgId)
        .single();

      if (chatError || !chat) {
        return NextResponse.json(
          { error: "Chat not found or access denied" },
          { status: 404 }
        );
      }

      // Verify user has access (owner or shared with)
      const isOwner = chat.created_by === userId;
      if (!isOwner) {
        const { data: share } = await supabaseAdmin
          .from("company_brain_chat_shares")
          .select("id")
          .eq("chat_id", chatId)
          .eq("user_id", userId)
          .single();

        if (!share) {
          return NextResponse.json(
            { error: "Access denied" },
            { status: 403 }
          );
        }
      }

      // Save the user message
      if (userMessage) {
        await supabaseAdmin.from("company_brain_messages").insert({
          chat_id: chatId,
          role: "user",
          content: userMessage,
        });

        // Update chat's updated_at and title (if first message)
        const updateData: { updated_at: string; title?: string } = {
          updated_at: new Date().toISOString(),
        };

        // Generate title from first user message if this is a new chat
        if (messages.length <= 2) {
          const firstUserMessage = messages.find(m => m.role === "user")?.content;
          if (firstUserMessage) {
            updateData.title = firstUserMessage.length > 50 
              ? firstUserMessage.slice(0, 50) + "..." 
              : firstUserMessage;
          }
        }

        await supabaseAdmin
          .from("company_brain_chats")
          .update(updateData)
          .eq("id", chatId);
      }
    }

    // Convert messages to Anthropic format
    const anthropicMessages: Anthropic.MessageParam[] = messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

    const systemPrompt = getSystemPrompt();

    // Initial request to Claude
    let response = await anthropic.messages.create({
      model: model || "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: systemPrompt,
      tools,
      messages: anthropicMessages,
    });

    // Handle tool use loop - must handle ALL tool_use blocks in each response
    while (response.stop_reason === "tool_use") {
      // Get ALL tool_use blocks (not just the first one)
      const toolUseBlocks = response.content.filter(
        (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
      );

      if (toolUseBlocks.length === 0) break;

      // Process each tool use and collect results
      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const toolUseBlock of toolUseBlocks) {
        let toolResult: string;

        if (toolUseBlock.name === "search_company_brain") {
          const input = toolUseBlock.input as {
            query: string;
            channel_name?: string;
            start_date?: string;
            end_date?: string;
          };

          try {
            const searchResults = await searchCompanyBrain(orgId, input.query, {
              topK: 10,
              startDate: input.start_date,
              endDate: input.end_date,
            });

            if (searchResults.length === 0) {
              toolResult = "No relevant information found in the Company Brain for this query.";
            } else {
              // Track sources and format results for Claude
              const formattedResults: string[] = [];

              for (let i = 0; i < searchResults.length; i++) {
                const result = searchResults[i];
                const date = new Date(result.timestamp).toLocaleDateString();

                if (result.sourceType === "slack") {
                  // Slack source
                  sources.push({
                    type: "slack",
                    channelName: result.channelName || "",
                    userName: result.userName || "",
                    timestamp: result.timestamp,
                    text: result.text,
                    slackLink: result.slackLink || "",
                    isThread: result.isThread || false,
                  });

                  formattedResults.push(`[Result ${i + 1} - Slack]
Channel: #${result.channelName}
From: ${result.userName}
Date: ${date}
Content: ${result.text}
${result.isThread ? "(This is part of a thread)" : ""}`);
                } else if (result.sourceType === "tldv") {
                  // tldv meeting source
                  sources.push({
                    type: "tldv",
                    meetingTitle: result.meetingTitle || "",
                    speaker: result.speaker,
                    timestamp: result.timestamp,
                    text: result.text,
                    tldvUrl: result.tldvUrl,
                    startTime: result.startTime,
                    endTime: result.endTime,
                  });

                  const timeRange = result.startTime !== undefined && result.endTime !== undefined
                    ? ` (${formatTime(result.startTime)}-${formatTime(result.endTime)})`
                    : "";

                  formattedResults.push(`[Result ${i + 1} - Meeting Recording]
Meeting: ${result.meetingTitle}
${result.speaker ? `Speaker: ${result.speaker}${timeRange}` : ""}
Date: ${date}
Content: ${result.text}`);
                }
              }

              toolResult = formattedResults.join("\n\n---\n\n");
            }
          } catch (error) {
            console.error("Search error:", error);
            toolResult = "Error searching the Company Brain. Please try again.";
          }
        } else {
          toolResult = `Unknown tool: ${toolUseBlock.name}`;
        }

        // Add this tool's result to the collection
        toolResults.push({
          type: "tool_result",
          tool_use_id: toolUseBlock.id,
          content: toolResult,
        });
      }

      // Continue conversation with ALL tool results
      response = await anthropic.messages.create({
        model: model || "claude-sonnet-4-20250514",
        max_tokens: 4096,
        system: systemPrompt,
        tools,
        messages: [
          ...anthropicMessages,
          { role: "assistant", content: response.content },
          {
            role: "user",
            content: toolResults,
          },
        ],
      });
    }

    // Extract the final text response
    const textBlock = response.content.find(
      (block): block is Anthropic.TextBlock => block.type === "text"
    );

    const assistantMessage = textBlock?.text || "I apologize, but I couldn't generate a response.";

    // Save assistant message to database if we have a chatId
    if (chatId) {
      await supabaseAdmin.from("company_brain_messages").insert({
        chat_id: chatId,
        role: "assistant",
        content: assistantMessage,
        sources: sources.length > 0 ? sources : null,
      });

      // Update chat's updated_at
      await supabaseAdmin
        .from("company_brain_chats")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", chatId);
    }

    return NextResponse.json({
      message: assistantMessage,
      sources: sources,
    });
  } catch (error) {
    console.error("Chat error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

