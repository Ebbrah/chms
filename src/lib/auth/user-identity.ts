import type { User } from "@supabase/supabase-js";

export type AuthDisplayIdentity = {
  fullName: string;
  email: string;
};

/** Name and email from the auth session (signup metadata), when profiles row is missing or sparse. */
export function getAuthDisplayIdentity(user: User): AuthDisplayIdentity {
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const fullName =
    String(meta.full_name ?? meta.fullName ?? "").trim() ||
    user.email?.split("@")[0]?.trim() ||
    "";
  const email = String(user.email ?? meta.email ?? "")
    .trim()
    .toLowerCase();
  return { fullName, email };
}

/** Prefer parish profile values; fall back to auth metadata for onboarding display. */
export function mergeProfileWithAuthIdentity(
  profile: { full_name?: string | null; email?: string | null } | null | undefined,
  user: User,
): AuthDisplayIdentity {
  const auth = getAuthDisplayIdentity(user);
  return {
    fullName: String(profile?.full_name ?? "").trim() || auth.fullName,
    email: String(profile?.email ?? "").trim() || auth.email,
  };
}
