"use client";

import { useState } from "react";

export function useAdmin() {
  const [loading] = useState(false);
  const [isAdmin] = useState(true);
  const [email] = useState<string | null>(null);
  const [userId] = useState<string | null>("dev-admin");

  return { loading, isAdmin, email, userId } as const;
}
