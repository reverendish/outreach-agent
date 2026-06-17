"use client";
import { useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
export default function ProspectRedirect() {
  const router = useRouter();
  const { number } = useParams<{ number: string }>();
  useEffect(() => { router.replace("/contacts"); }, [router, number]);
  return null;
}
