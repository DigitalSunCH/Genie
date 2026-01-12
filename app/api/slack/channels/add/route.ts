import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { slackClient } from "@/lib/slack";

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
    const { channelId, channelName } = body;

    if (!channelId) {
      return NextResponse.json(
        { error: "channelId is required" },
        { status: 400 }
      );
    }

    // Check if channel already exists for this org
    const { data: existing } = await supabaseAdmin
      .from("slack_channels")
      .select("id")
      .eq("organization_id", orgId)
      .eq("slack_channel_id", channelId)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: "Channel already added to this organization" },
        { status: 409 }
      );
    }

    // Join the channel so the bot can read messages
    try {
      await slackClient.conversations.join({ channel: channelId });
    } catch (joinError: unknown) {
      // Ignore "already_in_channel" error, but log others
      const error = joinError as { data?: { error?: string } };
      if (error.data?.error !== "already_in_channel") {
        console.warn("Could not join channel:", error);
      }
    }

    // Insert the new channel
    const { data, error } = await supabaseAdmin
      .from("slack_channels")
      .insert({
        organization_id: orgId,
        slack_channel_id: channelId,
        slack_channel_name: channelName || null,
      })
      .select()
      .single();

    if (error) {
      console.error("Supabase error:", error);
      return NextResponse.json(
        { error: "Failed to add channel" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, channel: data });
  } catch (error) {
    console.error("Error adding Slack channel:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

