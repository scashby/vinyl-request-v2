"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function Page() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const eventId = searchParams.get("eventId");
    const sessionId = searchParams.get("sessionId");
    if (sessionId) {
      router.replace(`/admin/games/bingo/test/host?sessionId=${sessionId}`);
      return;
    }
    if (eventId) {
      router.replace(`/admin/games/bingo/test?eventId=${eventId}`);
      return;
    }
    router.replace("/admin/games/bingo/test");
  }, [router, searchParams]);

  return null;
}
