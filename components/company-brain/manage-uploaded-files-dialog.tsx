"use client";

import * as React from "react";
import { FileText, Loader2, Trash2, Upload } from "lucide-react";

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

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  created_at: string;
}

interface ManageUploadedFilesDialogProps {
  files?: UploadedFile[];
  isLoading?: boolean;
  onFileUploaded?: () => void;
  onFileRemoved?: (fileId: string) => void;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function ManageUploadedFilesDialog({
  files = [],
  isLoading = false,
  onFileUploaded,
  onFileRemoved,
}: ManageUploadedFilesDialogProps) {
  const [open, setOpen] = React.useState(false);

  const fileCount = files.length;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="rounded-full font-bold">
          <Upload className="size-4" />
          {isLoading
            ? "Loading..."
            : `${fileCount} file${fileCount !== 1 ? "s" : ""}`}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Uploaded Files</DialogTitle>
          <DialogDescription>
            Manage files manually uploaded to your Company Brain.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : files.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p className="mb-4">No files uploaded yet.</p>
              <Button variant="outline" size="sm" disabled>
                <Upload className="size-4" />
                Upload Files
              </Button>
            </div>
          ) : (
            <ScrollArea className="max-h-[300px]">
              <div className="space-y-2">
                {files.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center justify-between rounded-md border bg-card p-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex size-8 items-center justify-center rounded-md bg-primary/10">
                        <FileText className="size-4 text-primary" />
                      </div>
                      <div>
                        <div className="font-medium text-sm truncate max-w-[200px]">
                          {file.name}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatFileSize(file.size)} • Added{" "}
                          {new Date(file.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => onFileRemoved?.(file.id)}
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

        {files.length > 0 && (
          <div className="flex justify-end">
            <Button variant="outline" size="sm" disabled>
              <Upload className="size-4" />
              Upload More
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

