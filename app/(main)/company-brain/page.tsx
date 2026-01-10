"use client";

import { Brain } from "lucide-react";
import PageHeader from "@/components/common/page-header";
import PageLayout from "@/components/common/page-layout";

export default function CompanyBrainPage() {
  return (
    <>
      <PageHeader
        titleUrl="/company-brain"
        title="Company Brain"
        icon={<Brain className="size-4" />}
      />
      <PageLayout className="h-[calc(100vh-3.5rem)] flex flex-col">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="rounded-full bg-primary/10 p-4 mb-4 mx-auto w-fit">
              <Brain className="size-8 text-primary" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Company Brain</h2>
            <p className="text-muted-foreground max-w-sm">
              Coming soon...
            </p>
          </div>
        </div>
      </PageLayout>
    </>
  );
}
