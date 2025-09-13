"use client";

export default function AdminGuard({ children }: { children: React.ReactNode }) {
  // Admin access is unrestricted
  return <>{children}</>;
}
