import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

type PageLayoutProps = {
  children: ReactNode;
  className?: string;
};

export default function PageLayout({ children, className }: PageLayoutProps) {
  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <Card
        className={cn(
          "flex flex-1 flex-col gap-4 p-6 border-0 shadow-none bg-muted/40",
          className
        )}
      >
        {children}
      </Card>
    </div>
  );
}

