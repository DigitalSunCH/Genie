import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// GET /api/company-brain/chats - List chats owned by user or shared with user
export async function GET() {
  try {
    const { orgId, userId } = await auth();

    if (!orgId || !userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get chats owned by the user
    const { data: ownedChats, error: ownedError } = await supabaseAdmin
      .from("company_brain_chats")
      .select("id, title, created_by, created_at, updated_at")
      .eq("organization_id", orgId)
      .eq("created_by", userId)
      .order("updated_at", { ascending: false });

    if (ownedError) {
      console.error("Error fetching owned chats:", ownedError);
      return NextResponse.json(
        { error: "Failed to fetch chats" },
        { status: 500 }
      );
    }

    // Get chats shared with the user (only from the same organization)
    const { data: sharedChatIds, error: sharedError } = await supabaseAdmin
      .from("company_brain_chat_shares")
      .select("chat_id")
      .eq("user_id", userId);

    if (sharedError) {
      console.error("Error fetching shared chats:", sharedError);
      return NextResponse.json(
        { error: "Failed to fetch shared chats" },
        { status: 500 }
      );
    }

    let sharedChats: typeof ownedChats = [];
    if (sharedChatIds && sharedChatIds.length > 0) {
      const chatIds = sharedChatIds.map((s) => s.chat_id);
      // Only fetch shared chats that belong to the current organization
      const { data: shared, error: sharedChatsError } = await supabaseAdmin
        .from("company_brain_chats")
        .select("id, title, created_by, created_at, updated_at")
        .in("id", chatIds)
        .eq("organization_id", orgId) // Filter by current org
        .order("updated_at", { ascending: false });

      if (sharedChatsError) {
        console.error("Error fetching shared chat details:", sharedChatsError);
      } else {
        sharedChats = shared || [];
      }
    }

    // Combine and deduplicate chats, sort by updated_at
    const allChats = [...(ownedChats || []), ...(sharedChats || [])];
    const uniqueChats = allChats.filter(
      (chat, index, self) => index === self.findIndex((c) => c.id === chat.id)
    );
    uniqueChats.sort(
      (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    );

    return NextResponse.json({ chats: uniqueChats });
  } catch (error) {
    console.error("Error in GET /api/company-brain/chats:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// POST /api/company-brain/chats - Create a new chat
export async function POST(request: Request) {
  try {
    const { orgId, userId } = await auth();

    if (!orgId || !userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const title = body.title || "New Chat";

    const { data: chat, error } = await supabaseAdmin
      .from("company_brain_chats")
      .insert({
        organization_id: orgId,
        title,
        created_by: userId,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating chat:", error);
      return NextResponse.json(
        { error: "Failed to create chat" },
        { status: 500 }
      );
    }

    return NextResponse.json({ chat });
  } catch (error) {
    console.error("Error in POST /api/company-brain/chats:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

