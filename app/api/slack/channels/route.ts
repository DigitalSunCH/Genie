import { NextResponse } from "next/server";
import { slackClient } from "@/lib/slack";

export async function GET() {
  try {
    const result = await slackClient.conversations.list({
      types: "public_channel,private_channel",
      exclude_archived: true,
      limit: 200,
    });

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error || "Failed to fetch channels" },
        { status: 500 }
      );
    }

    const channels = (result.channels || []).map((channel) => ({
      id: channel.id,
      name: channel.name,
      is_private: channel.is_private,
      num_members: channel.num_members,
    }));

    return NextResponse.json({ channels });
  } catch (error) {
    console.error("Error fetching Slack channels:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

