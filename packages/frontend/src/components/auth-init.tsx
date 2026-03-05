"use client";

import { useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import { setAuthTokenGetter } from "@/lib/api-client";

/**
 * Invisible component that wires up Clerk's session token to the API client.
 * Mount once in the root layout. No UI rendered.
 */
export function AuthInit() {
  const { getToken } = useAuth();

  useEffect(() => {
    setAuthTokenGetter(getToken);
  }, [getToken]);

  return null;
}
