"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function Page() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const templateId = searchParams.get("templateId");
    router.replace(templateId ? `/admin/games/bingo/test/setup?templateId=${templateId}` : "/admin/games/bingo/test");
  }, [router, searchParams]);

  return null;
}
