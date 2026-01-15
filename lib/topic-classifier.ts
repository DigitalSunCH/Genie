import Anthropic from "@anthropic-ai/sdk";

// Initialize Anthropic client
const anthropic = new Anthropic();

// =============================================================================
// Types
// =============================================================================

export interface SlackMessageForClassification {
  messageTs: string;
  threadTs?: string;
  userId: string;
  userName: string;
  text: string;
  timestamp: Date;
  channelId: string;
  channelName: string;
}

export interface TopicSummary {
  id: string;
  title: string;
  summary: string;
  messageCount: number;
}

export interface ClassificationResult {
  topicId: string | null; // null means create new topic
  newTopicTitle?: string;
  newTopicSummary?: string;
  confidence: number;
}

export interface TopicCompletionResult {
  isComplete: boolean;
  reason?: string;
  updatedSummary: string;
}

export interface MeetingSummaryResult {
  title: string;
  summary: string;
  keyTopics: string[];
  actionItems: string[];
}

// =============================================================================
// Topic Classification
// =============================================================================

/**
 * Classify a Slack message into an existing topic or suggest creating a new one
 */
export async function classifyMessage(
  message: SlackMessageForClassification,
  existingTopics: TopicSummary[]
): Promise<ClassificationResult> {
  const topicsContext =
    existingTopics.length > 0
      ? existingTopics
          .map(
            (t) =>
              `- Topic ID: ${t.id}\n  Title: ${t.title}\n  Summary: ${t.summary}\n  Messages: ${t.messageCount}`
          )
          .join("\n\n")
      : "No existing topics.";

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: `You are a topic classification system for a company's internal communications. Your job is to determine if a new Slack message belongs to an existing topic or if it starts a new topic.

## Existing Active Topics in Channel #${message.channelName}:
${topicsContext}

## New Message to Classify:
From: ${message.userName}
Time: ${message.timestamp.toISOString()}
Channel: #${message.channelName}
Message: ${message.text}

## Instructions:
1. If this message clearly belongs to one of the existing topics (related subject matter, continuation of a discussion), respond with that topic's ID.
2. If this message starts a new distinct topic of discussion, suggest a new topic title and brief summary.
3. Consider context: greetings, small talk, or off-topic messages should generally NOT create new topics unless they start a meaningful discussion.

Respond in JSON format:
{
  "topicId": "existing-topic-id-or-null",
  "newTopicTitle": "Title if new topic (omit if existing)",
  "newTopicSummary": "Brief summary if new topic (omit if existing)",
  "confidence": 0.0-1.0,
  "reasoning": "Brief explanation"
}`,
      },
    ],
  });

  // Parse the response
  const content = response.content[0];
  if (content.type !== "text") {
    throw new Error("Unexpected response type from Claude");
  }

  try {
    // Extract JSON from the response (handle markdown code blocks)
    let jsonStr = content.text;
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    }

    const parsed = JSON.parse(jsonStr.trim());

    return {
      topicId: parsed.topicId || null,
      newTopicTitle: parsed.newTopicTitle,
      newTopicSummary: parsed.newTopicSummary,
      confidence: parsed.confidence || 0.5,
    };
  } catch {
    // Default to creating a new topic if parsing fails
    console.error("Failed to parse classification response:", content.text);
    return {
      topicId: null,
      newTopicTitle: `Discussion in #${message.channelName}`,
      newTopicSummary: message.text.slice(0, 200),
      confidence: 0.3,
    };
  }
}

/**
 * Batch classify multiple messages for efficiency
 */
export async function classifyMessagesBatch(
  messages: SlackMessageForClassification[],
  existingTopics: TopicSummary[]
): Promise<Map<string, ClassificationResult>> {
  const results = new Map<string, ClassificationResult>();

  // Process messages sequentially to maintain context
  // (Each classification may create new topics that affect subsequent messages)
  const updatedTopics = [...existingTopics];

  for (const message of messages) {
    const result = await classifyMessage(message, updatedTopics);
    results.set(message.messageTs, result);

    // If a new topic was created, add it to the list for subsequent classifications
    if (!result.topicId && result.newTopicTitle) {
      updatedTopics.push({
        id: `pending_${message.messageTs}`,
        title: result.newTopicTitle,
        summary: result.newTopicSummary || "",
        messageCount: 1,
      });
    } else if (result.topicId) {
      // Update message count for existing topic
      const topic = updatedTopics.find((t) => t.id === result.topicId);
      if (topic) {
        topic.messageCount++;
      }
    }

    // Small delay to avoid rate limiting
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return results;
}

// =============================================================================
// Topic Completion Check
// =============================================================================

/**
 * Check if a topic is complete and ready for the inbox
 */
export async function checkTopicCompletion(
  topic: TopicSummary,
  recentMessages: SlackMessageForClassification[],
  lastMessageAge: number // minutes since last message
): Promise<TopicCompletionResult> {
  const messagesContext = recentMessages
    .map((m) => `[${m.userName}]: ${m.text}`)
    .join("\n");

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: `You are analyzing a Slack conversation topic to determine if it's complete enough to be summarized and archived.

## Topic Information:
Title: ${topic.title}
Current Summary: ${topic.summary}
Message Count: ${topic.messageCount}
Minutes Since Last Message: ${lastMessageAge}

## Recent Messages in This Topic:
${messagesContext}

## Criteria for Completion:
1. The conversation has reached a natural conclusion (decision made, question answered, etc.)
2. The topic has enough substance to be valuable (not just greetings or single messages)
3. No active back-and-forth is happening (consider time since last message)
4. The discussion contains actionable information or insights worth preserving

## Instructions:
Determine if this topic is "complete" and should be sent to the user's inbox for review.
If complete, provide an updated summary that captures the key points.
If not complete, explain why it should remain active.

Respond in JSON format:
{
  "isComplete": true/false,
  "reason": "Brief explanation",
  "updatedSummary": "Comprehensive summary if complete, otherwise current summary"
}`,
      },
    ],
  });

  const content = response.content[0];
  if (content.type !== "text") {
    throw new Error("Unexpected response type from Claude");
  }

  try {
    let jsonStr = content.text;
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    }

    const parsed = JSON.parse(jsonStr.trim());

    return {
      isComplete: parsed.isComplete || false,
      reason: parsed.reason,
      updatedSummary: parsed.updatedSummary || topic.summary,
    };
  } catch {
    console.error("Failed to parse completion response:", content.text);
    // Default: mark as not complete if we can't parse
    return {
      isComplete: false,
      reason: "Failed to analyze topic",
      updatedSummary: topic.summary,
    };
  }
}

// =============================================================================
// Meeting Summarization
// =============================================================================

/**
 * Generate a summary for a tldv meeting transcript
 */
export async function summarizeMeeting(
  meetingTitle: string,
  meetingDate: Date,
  participants: string[],
  transcriptChunks: string[]
): Promise<MeetingSummaryResult> {
  // Combine transcript chunks (limit to avoid token limits)
  const fullTranscript = transcriptChunks.slice(0, 50).join("\n\n");

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2048,
    messages: [
      {
        role: "user",
        content: `You are summarizing a meeting transcript for a company's knowledge base.

## Meeting Information:
Title: ${meetingTitle}
Date: ${meetingDate.toLocaleDateString()}
Participants: ${participants.join(", ")}

## Transcript:
${fullTranscript}

## Instructions:
Create a comprehensive summary that captures:
1. The main topics discussed
2. Key decisions made
3. Action items or next steps
4. Important insights or information shared

Respond in JSON format:
{
  "title": "Clear, descriptive title for the meeting (can be different from original)",
  "summary": "2-4 paragraph summary in markdown format covering the main points",
  "keyTopics": ["topic1", "topic2", ...],
  "actionItems": ["action item 1", "action item 2", ...]
}`,
      },
    ],
  });

  const content = response.content[0];
  if (content.type !== "text") {
    throw new Error("Unexpected response type from Claude");
  }

  try {
    let jsonStr = content.text;
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    }

    const parsed = JSON.parse(jsonStr.trim());

    return {
      title: parsed.title || meetingTitle,
      summary: parsed.summary || "Meeting summary unavailable.",
      keyTopics: parsed.keyTopics || [],
      actionItems: parsed.actionItems || [],
    };
  } catch {
    console.error("Failed to parse meeting summary:", content.text);
    return {
      title: meetingTitle,
      summary: "Failed to generate meeting summary. The transcript has been saved.",
      keyTopics: [],
      actionItems: [],
    };
  }
}

/**
 * Generate a brief summary for inbox card display
 */
export async function generateInboxSummary(
  type: "topic" | "meeting",
  title: string,
  content: string
): Promise<string> {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 512,
    messages: [
      {
        role: "user",
        content: `Create a brief, informative summary for display in an inbox card.

Type: ${type}
Title: ${title}
Content:
${content.slice(0, 3000)}

Instructions:
- Keep it under 200 words
- Use markdown for formatting
- Focus on the most important/actionable information
- Start with a brief overview, then bullet points for key items

Respond with just the summary text, no JSON wrapper.`,
      },
    ],
  });

  const contentBlock = response.content[0];
  if (contentBlock.type !== "text") {
    throw new Error("Unexpected response type from Claude");
  }

  return contentBlock.text;
}

