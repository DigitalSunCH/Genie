import { LayoutDashboard } from "lucide-react";
import PageHeader from "@/components/common/page-header";
import PageLayout from "@/components/common/page-layout";

export default function DashboardPage() {
  return (
    <>
      <PageHeader
        titleUrl="/dashboard"
        title="Dashboard"
        icon={<LayoutDashboard className="size-4" />}
      />
      <PageLayout>
        <div className="flex flex-col gap-4">
          <h2 className="text-2xl font-bold">Welcome to Genius</h2>
          <p className="text-muted-foreground">
            This is your dashboard. Start building your application here.
          </p>
        </div>
      </PageLayout>
    </>
  );
}

