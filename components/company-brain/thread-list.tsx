"use client";

import { useState } from "react";
import { Plus, MessageSquare, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export interface Thread {
  id: number;
  created_at: string;
  thread_id: string;
  name: string | null;
}

interface ThreadListProps {
  threads: Thread[];
  activeThreadId: string | null;
  onSelectThread: (threadId: string) => void;
  onCreateThread: () => void;
  onRenameThread: (threadId: string, newName: string) => void;
  onDeleteThread: (threadId: string) => void;
}

export function ThreadList({
  threads,
  activeThreadId,
  onSelectThread,
  onCreateThread,
  onRenameThread,
  onDeleteThread,
}: ThreadListProps) {
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedThread, setSelectedThread] = useState<Thread | null>(null);
  const [newName, setNewName] = useState("");

  const handleRenameClick = (thread: Thread) => {
    setSelectedThread(thread);
    setNewName(thread.name || "");
    setRenameDialogOpen(true);
  };

  const handleDeleteClick = (thread: Thread) => {
    setSelectedThread(thread);
    setDeleteDialogOpen(true);
  };

  const handleRenameConfirm = () => {
    if (selectedThread && newName.trim()) {
      onRenameThread(selectedThread.thread_id, newName.trim());
    }
    setRenameDialogOpen(false);
    setSelectedThread(null);
    setNewName("");
  };

  const handleDeleteConfirm = () => {
    if (selectedThread) {
      onDeleteThread(selectedThread.thread_id);
    }
    setDeleteDialogOpen(false);
    setSelectedThread(null);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return "Heute";
    if (diffDays === 1) return "Gestern";
    if (diffDays < 7) return `Vor ${diffDays} Tagen`;
    return date.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
  };

  return (
    <>
      <div className="flex flex-col h-full">
        <div className="p-3 border-b">
          <Button 
            onClick={onCreateThread} 
            className="w-full gap-2"
            size="sm"
          >
            <Plus className="size-4" />
            Neuer Chat
          </Button>
        </div>
        
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {threads.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Keine Chats vorhanden
              </p>
            ) : (
              threads.map((thread) => (
                <div
                  key={thread.thread_id}
                  className={`group flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${
                    activeThreadId === thread.thread_id
                      ? "bg-primary/10 text-primary"
                      : "hover:bg-muted"
                  }`}
                  onClick={() => onSelectThread(thread.thread_id)}
                >
                  <MessageSquare className="size-4 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {thread.name || "Unbenannter Chat"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(thread.created_at)}
                    </p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreHorizontal className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleRenameClick(thread)}>
                        <Pencil className="size-4 mr-2" />
                        Umbenennen
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => handleDeleteClick(thread)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="size-4 mr-2" />
                        Löschen
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Rename Dialog */}
      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Chat umbenennen</DialogTitle>
            <DialogDescription>
              Gib einen neuen Namen für diesen Chat ein.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Chat Name"
            onKeyDown={(e) => e.key === "Enter" && handleRenameConfirm()}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleRenameConfirm} disabled={!newName.trim()}>
              Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Chat löschen</DialogTitle>
            <DialogDescription>
              Bist du sicher, dass du diesen Chat löschen möchtest? Diese Aktion kann nicht rückgängig gemacht werden.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button variant="destructive" onClick={handleDeleteConfirm}>
              Löschen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
