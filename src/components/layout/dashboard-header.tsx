import { createClient } from "@/lib/supabase/server";
import { ThemeToggle } from "./theme-toggle";
import { SignOutButton } from "./sign-out-button";

export async function DashboardHeader() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle()
    : { data: null };
  const fullName = String(profile?.full_name ?? "").trim();
  const fallbackName = String(user?.user_metadata?.full_name ?? "").trim();
  const displayName = fullName || fallbackName || "Member";

  return (
    <header className="flex h-14 items-center justify-between border-b border-border px-4 md:px-6">
      <div className="text-sm text-muted-foreground">
        <span className="text-foreground">Welcome</span>{" "}
        <span className="font-medium text-primary">{displayName}</span>
      </div>
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <SignOutButton />
      </div>
    </header>
  );
}
