"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { readLastSection } from "@/lib/last-section";

/** `/library` opens whichever type you last had open (Games by default). */
export default function LibraryPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace(`/${readLastSection()}`);
  }, [router]);
  return null;
}
