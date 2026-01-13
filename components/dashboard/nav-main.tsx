"use client";

import * as React from "react";
import { ChartNoAxesColumn, Brain, CheckSquare, Calendar, Map, ChevronRight, Plus, Loader2, Ellipsis, Trash2, Share2, Search, MessageSquare } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ShareChatDialog } from "@/components/company-brain/share-chat-dialog";

interface Chat {
  id: string;
  title: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

const menuItems = [
  {
    title: "Dashboard",
    icon: ChartNoAxesColumn,
    url: "/dashboard",
  },
  {
    title: "Tasks",
    icon: CheckSquare,
    url: "/tasks",
  },
  {
    title: "Kalender",
    icon: Calendar,
    url: "/kalender",
  },
  {
    title: "Roadmap",
    icon: Map,
    url: "/roadmap",
  },
];

const MAX_VISIBLE_CHATS = 5;

export function NavMain() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [mounted, setMounted] = React.useState(false);
  const [chats, setChats] = React.useState<Chat[]>([]);
  const [isLoadingChats, setIsLoadingChats] = React.useState(true);

  // Handle hydration mismatch by only reading searchParams after mount
  React.useEffect(() => {
    setMounted(true);
  }, []);

  const currentChatId = mounted ? searchParams.get("chat") : null;
  const [isCreatingChat, setIsCreatingChat] = React.useState(false);
  const [companyBrainOpen, setCompanyBrainOpen] = React.useState(true);
  const [allChatsOpen, setAllChatsOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [shareDialogOpen, setShareDialogOpen] = React.useState(false);
  const [chatToShare, setChatToShare] = React.useState<Chat | null>(null);

  const isActive = (path: string) => pathname === path;
  const isCompanyBrainActive = pathname === "/company-brain";

  // Visible chats (first 5)
  const visibleChats = chats.slice(0, MAX_VISIBLE_CHATS);
  const remainingChatsCount = Math.max(0, chats.length - MAX_VISIBLE_CHATS);

  // Filtered chats for dialog
  const filteredChats = chats.filter((chat) =>
    chat.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Fetch chats
  const fetchChats = React.useCallback(async () => {
    try {
      const response = await fetch("/api/company-brain/chats");
      const data = await response.json();
      if (response.ok) {
        setChats(data.chats || []);
      }
    } catch (error) {
      console.error("Failed to fetch chats:", error);
    } finally {
      setIsLoadingChats(false);
    }
  }, []);

  React.useEffect(() => {
    fetchChats();
  }, [fetchChats]);

  // Create new chat
  const createNewChat = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsCreatingChat(true);
    try {
      const response = await fetch("/api/company-brain/chats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "New Chat" }),
      });
      const data = await response.json();
      if (response.ok) {
        setChats((prev) => [data.chat, ...prev]);
        router.push(`/company-brain?chat=${data.chat.id}`);
      }
    } catch (error) {
      console.error("Failed to create chat:", error);
    } finally {
      setIsCreatingChat(false);
    }
  };

  // Delete chat
  const deleteChat = async (chatId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const response = await fetch(`/api/company-brain/chats/${chatId}`, {
        method: "DELETE",
      });
      if (response.ok) {
        setChats((prev) => prev.filter((c) => c.id !== chatId));
        if (currentChatId === chatId) {
          router.push("/company-brain");
        }
      }
    } catch (error) {
      console.error("Failed to delete chat:", error);
    }
  };

  const handleChatClick = (chatId: string) => {
    setAllChatsOpen(false);
    router.push(`/company-brain?chat=${chatId}`);
  };

  const handleShareChat = (chat: Chat, e: React.MouseEvent) => {
    e.stopPropagation();
    setChatToShare(chat);
    setShareDialogOpen(true);
  };

  return (
    <SidebarGroup>
      <SidebarGroupContent>
        <SidebarMenu>
          {menuItems.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton
                asChild
                tooltip={item.title}
                isActive={isActive(item.url)}
              >
                <Link href={item.url}>
                  <item.icon className="size-4" />
                  <span>{item.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
          
          {/* Company Brain with collapsible chats */}
          <Collapsible
            asChild
            open={companyBrainOpen}
            onOpenChange={setCompanyBrainOpen}
            className="group/collapsible"
          >
            <SidebarMenuItem>
              <CollapsibleTrigger asChild>
                <SidebarMenuButton
                  tooltip="Company Brain"
                  isActive={isCompanyBrainActive && !currentChatId}
                  onClick={() => router.push("/company-brain")}
                  className="cursor-pointer"
                >
                  <Brain className="size-4" />
                  <span>Company Brain</span>
                  <ChevronRight className="ml-auto size-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                </SidebarMenuButton>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarMenuSub className="mx-0 px-0 border-l-0 ml-6">
                  {/* Chats header */}
                  <div className="flex items-center justify-between pr-2 py-1.5">
                    <span className="text-sm font-medium text-muted-foreground">Chats</span>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="h-6 px-2 text-xs cursor-pointer"
                      onClick={createNewChat}
                      disabled={isCreatingChat}
                    >
                      {isCreatingChat ? (
                        <Loader2 className="size-3 animate-spin mr-1" />
                      ) : (
                        <Plus className="size-3 mr-1" />
                      )}
                      New Chat
                    </Button>
                  </div>
                  {isLoadingChats ? (
                    <div className="flex items-center justify-center py-2">
                      <Loader2 className="size-4 animate-spin text-muted-foreground" />
                    </div>
                  ) : chats.length === 0 ? (
                    <div className="px-2 py-2 text-xs text-muted-foreground">
                      No chats yet
                    </div>
                  ) : (
                    <>
                      {visibleChats.map((chat) => (
                        <SidebarMenuSubItem key={chat.id} className="group/chat pr-2">
                          <SidebarMenuSubButton
                            asChild
                            isActive={currentChatId === chat.id}
                            className="pr-8"
                          >
                            <Link href={`/company-brain?chat=${chat.id}`}>
                              <span className="truncate">{chat.title}</span>
                            </Link>
                          </SidebarMenuSubButton>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="absolute right-3 top-0.5 size-6 opacity-0 group-hover/chat:opacity-100 transition-opacity"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Ellipsis className="size-3" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" side="right">
                              <DropdownMenuItem
                                onClick={(e) => handleShareChat(chat, e)}
                              >
                                <Share2 className="size-4 mr-2" />
                                Share
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={(e) => deleteChat(chat.id, e)}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="size-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </SidebarMenuSubItem>
                      ))}
                      
                      {/* Show more chats button */}
                      {remainingChatsCount > 0 && (
                        <Dialog open={allChatsOpen} onOpenChange={setAllChatsOpen}>
                          <DialogTrigger asChild>
                            <button className="w-full text-left px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                              {remainingChatsCount} more chat{remainingChatsCount !== 1 ? "s" : ""}...
                            </button>
                          </DialogTrigger>
                          <DialogContent className="max-w-md">
                            <DialogHeader>
                              <DialogTitle className="flex items-center gap-2">
                                All Chats
                              </DialogTitle>
                            </DialogHeader>
                            <div className="relative">
                              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                              <Input
                                placeholder="Search chats..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9"
                              />
                            </div>
                            <ScrollArea className="max-h-[400px]">
                              <div className="space-y-1">
                                {filteredChats.length === 0 ? (
                                  <p className="text-sm text-muted-foreground text-center py-4">
                                    No chats found
                                  </p>
                                ) : (
                                  filteredChats.map((chat) => (
                                    <div
                                      key={chat.id}
                                      onClick={() => handleChatClick(chat.id)}
                                      className={`group flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${
                                        currentChatId === chat.id
                                          ? "bg-primary/10 text-primary"
                                          : "hover:bg-muted"
                                      }`}
                                    >
                                      <span className="text-sm truncate flex-1">
                                        {chat.title}
                                      </span>
                                      <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="size-7 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                                            onClick={(e) => e.stopPropagation()}
                                          >
                                            <Ellipsis className="size-4" />
                                          </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                          <DropdownMenuItem
                                            onClick={(e) => handleShareChat(chat, e)}
                                          >
                                            <Share2 className="size-4 mr-2" />
                                            Share
                                          </DropdownMenuItem>
                                          <DropdownMenuItem
                                            onClick={(e) => deleteChat(chat.id, e)}
                                            className="text-destructive focus:text-destructive"
                                          >
                                            <Trash2 className="size-4 mr-2" />
                                            Delete
                                          </DropdownMenuItem>
                                        </DropdownMenuContent>
                                      </DropdownMenu>
                                    </div>
                                  ))
                                )}
                              </div>
                            </ScrollArea>
                          </DialogContent>
                        </Dialog>
                      )}
                    </>
                  )}
                </SidebarMenuSub>
              </CollapsibleContent>
            </SidebarMenuItem>
          </Collapsible>
        </SidebarMenu>
      </SidebarGroupContent>

      {/* Share Chat Dialog */}
      {chatToShare && (
        <ShareChatDialog
          chatId={chatToShare.id}
          chatTitle={chatToShare.title}
          createdBy={chatToShare.created_by}
          open={shareDialogOpen}
          onOpenChange={setShareDialogOpen}
        />
      )}
    </SidebarGroup>
  );
}
