"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function CompanyBrainInboxPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/company-brain");
  }, [router]);

  return null;
}
