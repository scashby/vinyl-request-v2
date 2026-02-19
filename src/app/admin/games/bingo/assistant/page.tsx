"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function Page() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const sessionId = searchParams.get("sessionId");
    router.replace(sessionId ? `/admin/games/bingo/test/sidekick?sessionId=${sessionId}` : "/admin/games/bingo/test");
  }, [router, searchParams]);

  return null;
}
