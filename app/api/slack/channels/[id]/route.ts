import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { deleteChannelRecords } from "@/lib/pinecone";

export async function DELETE(
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

    // First, get the channel to retrieve the slack_channel_id
    const { data: channel, error: fetchError } = await supabaseAdmin
      .from("slack_channels")
      .select("slack_channel_id")
      .eq("id", id)
      .eq("organization_id", orgId)
      .single();

    if (fetchError || !channel) {
      console.error("Channel not found:", fetchError);
      return NextResponse.json(
        { error: "Channel not found" },
        { status: 404 }
      );
    }

    // Delete records from Pinecone first
    try {
      await deleteChannelRecords(orgId, channel.slack_channel_id);
      console.log(`Deleted Pinecone records for channel ${channel.slack_channel_id}`);
    } catch (pineconeError) {
      console.error("Failed to delete Pinecone records:", pineconeError);
      // Continue with Supabase deletion even if Pinecone fails
      // Records will be orphaned but won't affect functionality
    }

    // Delete channel from Supabase
    const { error } = await supabaseAdmin
      .from("slack_channels")
      .delete()
      .eq("id", id)
      .eq("organization_id", orgId);

    if (error) {
      console.error("Supabase error:", error);
      return NextResponse.json(
        { error: "Failed to delete channel" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting channel:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

