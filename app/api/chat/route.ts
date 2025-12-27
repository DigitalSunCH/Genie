import Anthropic from "@anthropic-ai/sdk";
import { COMPANY_CONTEXT } from "@/lib/company-context";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(request: Request) {
  try {
    const { messages, model = "claude-sonnet-4-20250514" } = await request.json();

    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "Messages are required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Convert messages to Anthropic format
    const anthropicMessages = messages.map((msg: { sender: string; text: string }) => ({
      role: (msg.sender === "user" ? "user" : "assistant") as "user" | "assistant",
      content: msg.text,
    }));

    // Create streaming response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const response = await anthropic.messages.create({
            model: model,
            max_tokens: 4096,
            system: COMPANY_CONTEXT,
            messages: anthropicMessages,
            stream: true,
          });

          for await (const event of response) {
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta"
            ) {
              const chunk = JSON.stringify({ text: event.delta.text }) + "\n";
              controller.enqueue(encoder.encode(chunk));
            }
          }
          controller.close();
        } catch (error) {
          console.error("Claude API Error:", error);
          controller.error(error);
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Chat API Error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to process chat request" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

