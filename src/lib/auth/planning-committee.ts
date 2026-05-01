import { createClient } from "@/lib/supabase/server";

/** True if the signed-in user is assigned as head of the Planning (Mipango) committee. */
export async function userHeadsPlanningCommittee(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const { data: heads } = await supabase
    .from("committee_heads")
    .select("committee_id")
    .eq("user_id", user.id);
  const ids = (heads ?? []).map((h) => h.committee_id).filter(Boolean);
  if (!ids.length) return false;

  const { data: comms } = await supabase.from("committees").select("id, key").in("id", ids);
  return Boolean(comms?.some((c) => c.key === "planning"));
}
