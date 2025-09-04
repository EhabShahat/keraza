"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { AdminGuardProps } from "./types";
import { authFetch } from "@/lib/authFetch";

function AdminGuardInner({ children }: AdminGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await authFetch("/api/admin/whoami");
        if (!cancelled && res.ok) {
          setAllowed(true);
        } else if (!cancelled) {
          const qs = searchParams?.toString();
          const next = encodeURIComponent(pathname + (qs ? `?${qs}` : ""));
          router.replace(`/admin/login?next=${next}`);
        }
      } catch {
        if (!cancelled) {
          const qs = searchParams?.toString();
          const next = encodeURIComponent(pathname + (qs ? `?${qs}` : ""));
          router.replace(`/admin/login?next=${next}`);
        }
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router, pathname, searchParams]);

  if (checking) {
    return (
      <div className="p-6 text-gray-600">
        <div className="w-5 h-5 mr-2 inline-block border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        Checking admin access...
      </div>
    );
  }

  if (!allowed) return null;
  return <>{children}</>;
}

export default function AdminGuard(props: AdminGuardProps) {
  return (
    <Suspense
      fallback={
        <div className="p-6 text-gray-600">
          <div className="w-5 h-5 mr-2 inline-block border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          Checking admin access...
        </div>
      }
    >
      <AdminGuardInner {...props} />
    </Suspense>
  );
}

// Export types for external use
export * from "./types";