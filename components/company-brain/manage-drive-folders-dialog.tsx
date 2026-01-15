"use client";

import * as React from "react";
import Image from "next/image";
import { Folder, Loader2, Trash2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

interface DriveFolder {
  id: string;
  name: string;
  created_at: string;
}

interface ManageDriveFoldersDialogProps {
  folders?: DriveFolder[];
  isLoading?: boolean;
  onFolderAdded?: () => void;
  onFolderRemoved?: (folderId: string) => void;
}

export function ManageDriveFoldersDialog({
  folders = [],
  isLoading = false,
  onFolderAdded,
  onFolderRemoved,
}: ManageDriveFoldersDialogProps) {
  const [open, setOpen] = React.useState(false);

  const folderCount = folders.length;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="rounded-full">
          <Image src="/drive.png" alt="Google Drive" width={16} height={16} />
          {isLoading
            ? "Loading..."
            : `${folderCount} Folder${folderCount !== 1 ? "s" : ""}`}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Connected Google Drive Folders</DialogTitle>
          <DialogDescription>
            Manage the Google Drive folders connected to your Company Brain.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : folders.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p className="mb-4">No folders connected yet.</p>
              <Button variant="outline" size="sm" disabled>
                Connect Google Drive
              </Button>
            </div>
          ) : (
            <ScrollArea className="max-h-[300px]">
              <div className="space-y-2">
                {folders.map((folder) => (
                  <div
                    key={folder.id}
                    className="flex items-center justify-between rounded-md border bg-card p-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex size-8 items-center justify-center rounded-md bg-muted">
                        <Image src="/drive.png" alt="Google Drive" width={16} height={16} />
                      </div>
                      <div>
                        <div className="font-medium text-sm">{folder.name}</div>
                        <div className="text-xs text-muted-foreground">
                          Added {new Date(folder.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => onFolderRemoved?.(folder.id)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>

        {folders.length > 0 && (
          <div className="flex justify-end">
            <Button variant="outline" size="sm" disabled>
              Add Folder
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

