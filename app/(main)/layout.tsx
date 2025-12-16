import type { ReactNode } from "react";
import { AppSidebar } from "@/components/dashboard/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

type LayoutProps = {
  children: ReactNode;
};

export default function MainLayout({ children }: LayoutProps) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>{children}</SidebarInset>
    </SidebarProvider>
  );
}

