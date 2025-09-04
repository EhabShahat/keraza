"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { authFetch } from "@/lib/authFetch";

export default function AdminLogoutPage() {
  const router = useRouter();
  useEffect(() => {
    (async () => {
      try {
        await authFetch("/api/auth/logout", { method: "POST" });
      } catch {}
      router.replace("/admin/login");
    })();
  }, [router]);
  return <div className="p-6">Signing out...</div>;
}
