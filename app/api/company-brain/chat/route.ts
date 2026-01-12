import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import Anthropic from "@anthropic-ai/sdk";
import { searchSlackMessages } from "@/lib/pinecone";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

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
  return `You are the Company Brain assistant - an AI that helps users find and understand information from their company's connected data sources including Slack channels, meeting recordings, and documents.

Today's date is ${today}.

When users ask questions about internal discussions, decisions, projects, team updates, or company knowledge:
1. Use the search_company_brain tool to find relevant information
2. For time-based queries like "last week", "yesterday", "this month", calculate the appropriate start_date and end_date
3. For channel-specific queries like "in #engineering", use the channel_name filter
4. Synthesize the results into a clear, helpful answer
5. Always cite your sources by mentioning the channel name, who said it, and when

When you don't find relevant information, be honest and let the user know. For general questions not related to company knowledge, you can answer directly without searching.

Be conversational, helpful, and concise.`;
};

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

// Source type for tracking where information came from
interface Source {
  type: "slack";
  channelName: string;
  userName: string;
  timestamp: string;
  text: string;
  slackLink: string;
  isThread: boolean;
}

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

    // If we have a chatId and userMessage, save the user message first
    if (chatId && userMessage) {
      await supabaseAdmin.from("company_brain_messages").insert({
        chat_id: chatId,
        role: "user",
        content: userMessage,
      });

      // Update chat's updated_at
      await supabaseAdmin
        .from("company_brain_chats")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", chatId);
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

    // Handle tool use loop
    while (response.stop_reason === "tool_use") {
      const toolUseBlock = response.content.find(
        (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
      );

      if (!toolUseBlock) break;

      let toolResult: string;

      if (toolUseBlock.name === "search_company_brain") {
        const input = toolUseBlock.input as { 
          query: string;
          channel_name?: string;
          start_date?: string;
          end_date?: string;
        };
        
        try {
          const searchResults = await searchSlackMessages(orgId, input.query, {
            topK: 10,
            channelName: input.channel_name,
            startDate: input.start_date,
            endDate: input.end_date,
          });

          if (searchResults.length === 0) {
            toolResult = "No relevant information found in the Company Brain for this query.";
          } else {
            // Track sources for the response
            for (const result of searchResults) {
              sources.push({
                type: "slack",
                channelName: result.channelName,
                userName: result.userName,
                timestamp: result.timestamp,
                text: result.text,
                slackLink: result.slackLink,
                isThread: result.isThread,
              });
            }

            // Format results for Claude
            toolResult = searchResults
              .map((result, index) => {
                const date = new Date(result.timestamp).toLocaleDateString();
                return `[Result ${index + 1}]
Channel: #${result.channelName}
From: ${result.userName}
Date: ${date}
Content: ${result.text}
${result.isThread ? "(This is part of a thread)" : ""}`;
              })
              .join("\n\n---\n\n");
          }
        } catch (error) {
          console.error("Search error:", error);
          toolResult = "Error searching the Company Brain. Please try again.";
        }
      } else {
        toolResult = `Unknown tool: ${toolUseBlock.name}`;
      }

      // Continue conversation with tool result
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
            content: [
              {
                type: "tool_result",
                tool_use_id: toolUseBlock.id,
                content: toolResult,
              },
            ],
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

      // Generate title from first user message if this is a new chat (only 1-2 messages)
      if (messages.length <= 2) {
        const firstUserMessage = messages.find(m => m.role === "user")?.content;
        if (firstUserMessage) {
          // Use first 50 chars of the message as title
          const title = firstUserMessage.length > 50 
            ? firstUserMessage.slice(0, 50) + "..." 
            : firstUserMessage;
          
          await supabaseAdmin
            .from("company_brain_chats")
            .update({ title })
            .eq("id", chatId);
        }
      }
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

