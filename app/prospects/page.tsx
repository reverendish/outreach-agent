"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
export default function ProspectsRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace("/contacts"); }, [router]);
  return null;
}
