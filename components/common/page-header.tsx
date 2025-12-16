import type { ReactNode } from "react";
import Link from "next/link";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

type PageHeaderProps = {
  title: string;
  titleUrl: string;
  icon?: ReactNode;
  description?: string;
  children?: ReactNode;
};

export default function PageHeader({
  title,
  titleUrl,
  icon,
  description,
  children,
}: PageHeaderProps) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-2 px-4">
      <div className="flex items-center gap-2">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="h-4" />
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href={titleUrl} className="flex items-center gap-2">
                  {icon}
                  <span>{title}</span>
                </Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            {description && (
              <>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>{description}</BreadcrumbPage>
                </BreadcrumbItem>
              </>
            )}
          </BreadcrumbList>
        </Breadcrumb>
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </header>
  );
}

