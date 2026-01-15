import { auth } from "@clerk/nextjs/server";
import Anthropic from "@anthropic-ai/sdk";
import { searchCompanyBrain } from "@/lib/pinecone";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { formatTime } from "@/lib/tldv";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Define tools for Claude
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
  {
    name: "web_search",
    description:
      "Search the web for current information, news, or topics not found in the company knowledge base. Use this for external information like industry news, competitor research, technology documentation, market trends, or any general questions that require up-to-date information from the internet.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "The search query to find information on the web",
        },
      },
      required: ["query"],
    },
  },
];

const getSystemPrompt = () => {
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const currentTime = now.toLocaleTimeString('en-US', { 
    hour: '2-digit', 
    minute: '2-digit', 
    hour12: true,
    timeZone: 'Europe/Berlin'
  });
  const dayOfWeek = now.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'Europe/Berlin' });
  
  return `You are the Company Brain assistant - an AI that helps users find and understand information from their company's connected data sources including Slack channels, tl;dv meeting recordings, and documents. You can also search the web for external information.

## Current Date & Time (Authoritative - DO NOT use web search for this)
- **Today**: ${dayOfWeek}, ${today}
- **Current Time**: ${currentTime} (Europe/Berlin timezone)

IMPORTANT: For ANY questions about the current date, time, day of week, or "what day is it" - use the information above directly. Do NOT use web_search for time/date queries as web results may be outdated or incorrect.

## When to Use Each Tool

**search_company_brain** - Use for:
- Internal discussions, decisions, and projects
- Team updates and company knowledge
- What was discussed in meetings or Slack
- For time-based queries like "last week", "yesterday", etc., calculate dates based on today's date (${today})

**web_search** - Use for:
- Industry news and market trends
- Competitor research
- Technology documentation and tutorials
- Current events and external information
- General knowledge questions
- Anything not specific to the company's internal data
- NEVER use for time/date queries - use the authoritative date/time provided above

## Guidelines

1. Choose the right tool based on whether the question is about internal company matters or external information
2. You can use both tools if needed (e.g., comparing internal strategy to industry trends)
3. Synthesize the results into a clear, helpful answer
4. Always cite your sources:
   - For Slack: mention the channel name, who said it, and when
   - For meeting recordings: mention the meeting title, speaker, and timestamp
   - For web results: mention the source title and provide context

When you don't find relevant information, be honest and let the user know.

## Response Formatting Guidelines

Always format your responses using rich markdown for readability:

- **Use headings** (## or ###) to organize different sections or topics
- **Bold important terms**, names, dates, and key takeaways using **double asterisks**
- Use *italics* for emphasis or quotes from sources
- Structure information with:
  - **Bullet points** for lists of items, features, or multiple points
  - **Numbered lists** for sequential steps or ranked items
- Use \`code formatting\` for technical terms, commands, or specific identifiers
- When summarizing from multiple sources, group related information under clear headings
- Add horizontal rules (---) to separate distinct topics when needed
- For quotes from Slack or meetings, use blockquotes (> quote text)

Keep responses well-organized, scannable, and visually clear. Avoid walls of plain text.`;
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

interface WebSource {
  type: "web";
  title: string;
  url: string;
  content: string;
}

type Source = SlackSource | TldvSource | WebSource;

// Helper to send SSE event
function sendEvent(controller: ReadableStreamDefaultController, event: string, data: unknown) {
  const encoder = new TextEncoder();
  controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
}

export async function POST(request: Request) {
  const { orgId, userId } = await auth();

  if (!orgId || !userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { 
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }

  const { messages, model, chatId, userMessage, enabledTools } = (await request.json()) as {
    messages: ChatMessage[];
    model?: string;
    chatId?: string;
    userMessage?: string;
    enabledTools?: string[];
  };

  if (!messages || messages.length === 0) {
    return new Response(JSON.stringify({ error: "Messages are required" }), { 
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  // Track sources used during this request
  const sources: Source[] = [];

  // Verify chat access and save user message
  if (chatId) {
    const { data: chat, error: chatError } = await supabaseAdmin
      .from("company_brain_chats")
      .select("id, created_by")
      .eq("id", chatId)
      .eq("organization_id", orgId)
      .single();

    if (chatError || !chat) {
      return new Response(JSON.stringify({ error: "Chat not found" }), { 
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
    }

    const isOwner = chat.created_by === userId;
    if (!isOwner) {
      const { data: share } = await supabaseAdmin
        .from("company_brain_chat_shares")
        .select("id")
        .eq("chat_id", chatId)
        .eq("user_id", userId)
        .single();

      if (!share) {
        return new Response(JSON.stringify({ error: "Access denied" }), { 
          status: 403,
          headers: { "Content-Type": "application/json" }
        });
      }
    }

    if (userMessage) {
      await supabaseAdmin.from("company_brain_messages").insert({
        chat_id: chatId,
        role: "user",
        content: userMessage,
      });

      const updateData: { updated_at: string; status: string; title?: string } = {
        updated_at: new Date().toISOString(),
        status: "loading",
      };

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

  // Create streaming response
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const anthropicMessages: Anthropic.MessageParam[] = messages.map((msg) => ({
          role: msg.role,
          content: msg.content,
        }));

        const activeTools = enabledTools && enabledTools.length > 0
          ? tools.filter(tool => enabledTools.includes(tool.name))
          : tools;

        const systemPrompt = getSystemPrompt();
        let currentMessages = [...anthropicMessages];
        let finalText = "";

        // Tool execution loop
        let continueLoop = true;
        while (continueLoop) {
          // Non-streaming call to detect tool use
          const response = await anthropic.messages.create({
            model: model || "claude-sonnet-4-20250514",
            max_tokens: 4096,
            system: systemPrompt,
            tools: activeTools.length > 0 ? activeTools : undefined,
            messages: currentMessages,
          });

          if (response.stop_reason === "tool_use") {
            const toolUseBlocks = response.content.filter(
              (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
            );

            const toolResults: Anthropic.ToolResultBlockParam[] = [];

            for (const toolUseBlock of toolUseBlocks) {
              // Send tool_start event
              sendEvent(controller, "tool_start", { 
                tool: toolUseBlock.name,
                query: (toolUseBlock.input as { query?: string }).query || ""
              });

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
                    const formattedResults: string[] = [];

                    for (let i = 0; i < searchResults.length; i++) {
                      const result = searchResults[i];
                      const date = new Date(result.timestamp).toLocaleDateString();

                      if (result.sourceType === "slack") {
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
              } else if (toolUseBlock.name === "web_search") {
                const input = toolUseBlock.input as { query: string };

                try {
                  const webResponse = await fetch("https://api.tavily.com/search", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      api_key: process.env.TAVILY_API_KEY,
                      query: input.query,
                      search_depth: "basic",
                      max_results: 5,
                    }),
                  });

                  const data = await webResponse.json();

                  if (data.results && data.results.length > 0) {
                    const formattedResults: string[] = [];

                    for (let i = 0; i < data.results.length; i++) {
                      const result = data.results[i];
                      
                      sources.push({
                        type: "web",
                        title: result.title,
                        url: result.url,
                        content: result.content,
                      });

                      formattedResults.push(`[Result ${i + 1} - Web]
Title: ${result.title}
URL: ${result.url}
Content: ${result.content}`);
                    }

                    toolResult = formattedResults.join("\n\n---\n\n");
                  } else {
                    toolResult = "No web results found for this query.";
                  }
                } catch (error) {
                  console.error("Web search error:", error);
                  toolResult = "Error performing web search. Please try again.";
                }
              } else {
                toolResult = `Unknown tool: ${toolUseBlock.name}`;
              }

              // Send tool_end event
              sendEvent(controller, "tool_end", { tool: toolUseBlock.name });

              toolResults.push({
                type: "tool_result",
                tool_use_id: toolUseBlock.id,
                content: toolResult,
              });
            }

            // Update messages for next iteration
            currentMessages = [
              ...currentMessages,
              { role: "assistant" as const, content: response.content },
              { role: "user" as const, content: toolResults },
            ];
          } else {
            // No more tool use - time to stream the final response
            continueLoop = false;
            
            // Send generating event
            sendEvent(controller, "generating", {});

            // Now stream the final response
            const streamResponse = anthropic.messages.stream({
              model: model || "claude-sonnet-4-20250514",
              max_tokens: 4096,
              system: systemPrompt,
              tools: activeTools.length > 0 ? activeTools : undefined,
              messages: currentMessages,
            });

            for await (const event of streamResponse) {
              if (event.type === "content_block_delta") {
                const delta = event.delta;
                if ("text" in delta) {
                  finalText += delta.text;
                  sendEvent(controller, "text_delta", { text: delta.text });
                }
              }
            }
          }
        }

        // Send sources
        if (sources.length > 0) {
          sendEvent(controller, "sources", sources);
        }

        // Save to database
        if (chatId && finalText) {
          await supabaseAdmin.from("company_brain_messages").insert({
            chat_id: chatId,
            role: "assistant",
            content: finalText,
            sources: sources.length > 0 ? sources : null,
          });

          await supabaseAdmin
            .from("company_brain_chats")
            .update({ updated_at: new Date().toISOString(), status: "idle" })
            .eq("id", chatId);
        }

        // Send done event
        sendEvent(controller, "done", {});
        controller.close();
      } catch (error) {
        console.error("Streaming error:", error);
        sendEvent(controller, "error", { 
          message: error instanceof Error ? error.message : "Unknown error" 
        });
        
        // Reset chat status on error
        if (chatId) {
          await supabaseAdmin
            .from("company_brain_chats")
            .update({ status: "idle" })
            .eq("id", chatId);
        }
        
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
