import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { searchSlackMessages, SlackSearchResult } from "@/lib/pinecone";

export interface SearchResponse {
  results: SlackSearchResult[];
  query: string;
  totalResults: number;
}

/**
 * POST /api/company-brain/search
 * Searches vectorized Slack messages in Pinecone
 */
export async function POST(request: Request) {
  try {
    const { orgId } = await auth();

    if (!orgId) {
      return NextResponse.json(
        { error: "Unauthorized - no organization selected" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { query, channelId, topK } = body as {
      query?: string;
      channelId?: string;
      topK?: number;
    };

    if (!query || typeof query !== "string" || query.trim().length === 0) {
      return NextResponse.json(
        { error: "Query is required and must be a non-empty string" },
        { status: 400 }
      );
    }

    // Search Pinecone
    const results = await searchSlackMessages(orgId, query.trim(), {
      topK: topK ?? 10,
      channelId,
    });

    const response: SearchResponse = {
      results,
      query: query.trim(),
      totalResults: results.length,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error searching company brain:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

