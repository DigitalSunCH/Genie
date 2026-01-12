import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// GET /api/company-brain/chats - List all chats for the organization
export async function GET() {
  try {
    const { orgId } = await auth();

    if (!orgId) {
      return NextResponse.json(
        { error: "Unauthorized - no organization selected" },
        { status: 401 }
      );
    }

    const { data: chats, error } = await supabaseAdmin
      .from("company_brain_chats")
      .select("id, title, created_by, created_at, updated_at")
      .eq("organization_id", orgId)
      .order("updated_at", { ascending: false });

    if (error) {
      console.error("Error fetching chats:", error);
      return NextResponse.json(
        { error: "Failed to fetch chats" },
        { status: 500 }
      );
    }

    return NextResponse.json({ chats });
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

