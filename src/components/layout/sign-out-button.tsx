"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ActionButton } from "@/components/ui/action-button";

export function SignOutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function signOut() {
    if (loading) return;
    setLoading(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push("/login");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <ActionButton
      type="button"
      variant="outline"
      size="sm"
      loading={loading}
      loadingText="Signing out…"
      onClick={() => void signOut()}
    >
      Sign out
    </ActionButton>
  );
}
