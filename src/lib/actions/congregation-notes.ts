"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getMyRoles } from "@/lib/auth/session";
import { hasRole } from "@/lib/auth/permissions";

function parseDataUrlImage(
  dataUrl: string,
): { contentType: string; bytes: Uint8Array; extension: string } | null {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) return null;

  const contentType = match[1];
  const base64 = match[2];
  const bytes = Buffer.from(base64, "base64");

  let extension = "jpg";
  if (contentType.includes("png")) extension = "png";
  else if (contentType.includes("webp")) extension = "webp";
  else if (contentType.includes("gif")) extension = "gif";
  else if (contentType.includes("jpeg") || contentType.includes("jpg")) extension = "jpg";

  return { contentType, bytes, extension };
}

async function orgContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, org_id: null as string | null };
  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id")
    .eq("id", user.id)
    .single();
  return { supabase, user, org_id: profile?.org_id ?? null };
}

export async function createCongregationNote(formData: FormData) {
  const { supabase, user, org_id } = await orgContext();
  if (!user || !org_id) return { error: "Unauthorized" };

  const roles = await getMyRoles();
  const isPastor = hasRole(roles, "pastor");
  const isChair = hasRole(roles, "jumuiya_chairman");
  const isCommitteeHead = hasRole(roles, "committee_head");
  if (!isPastor && !isCommitteeHead && !isChair) return { error: "Unauthorized" };

  const title = String(formData.get("title") || "").trim();
  const body = String(formData.get("body") || "").trim();
  const scope = String(formData.get("scope") || "global");
  const imageDataUrl = String(formData.get("image_data_url") || "").trim();
  if (!title) return { error: "Title is required" };
  if (!body && !imageDataUrl) return { error: "Write a message or upload a poster/flier image" };

  let household_id: string | null = null;
  if (scope === "jumuiya") {
    const { data: assign, error: aErr } = await supabase
      .from("jumuiya_chair_assignments")
      .select("household_id")
      .eq("org_id", org_id)
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();
    if (aErr) return { error: aErr.message };
    if (!assign?.household_id) return { error: "No Jumuiya assignment found for this user" };
    household_id = String(assign.household_id);
    const { data: canPublishJumuiya, error: canPublishErr } = await supabase.rpc(
      "can_publish_jumuiya_note",
      { _household_id: household_id },
    );
    if (canPublishErr) return { error: canPublishErr.message };
    if (!canPublishJumuiya) return { error: "You are not allowed to publish notes for this Jumuiya" };
  } else if (!isPastor && !isCommitteeHead) {
    return { error: "Only Pastor or committee heads can post global notes" };
  } else {
    const { data: canPublishGlobal, error: canPublishErr } = await supabase.rpc("can_publish_global_note");
    if (canPublishErr) return { error: canPublishErr.message };
    if (!canPublishGlobal) {
      return { error: "Only Pastor or committee head can post global notes" };
    }
  }

  let imagePath: string | null = null;
  let imageUrl: string | null = null;

  if (imageDataUrl) {
    const parsed = parseDataUrlImage(imageDataUrl);
    if (!parsed) return { error: "Invalid poster/flier image format" };
    const path = `${org_id}/${user.id}/notes-${Date.now()}.${parsed.extension}`;
    const upload = await supabase.storage
      .from("congregation-note-media")
      .upload(path, parsed.bytes, { contentType: parsed.contentType, upsert: true });
    if (upload.error) return { error: upload.error.message };
    const { data } = supabase.storage.from("congregation-note-media").getPublicUrl(path);
    imagePath = path;
    imageUrl = data.publicUrl;
  }

  const { error } = await supabase.from("congregation_notes").insert({
    org_id,
    author_user_id: user.id,
    title,
    body: body || "",
    household_id,
    image_path: imagePath,
    image_url: imageUrl,
  });
  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  return { ok: true };
}

export async function deleteCongregationNote(noteId: string) {
  const { supabase, user, org_id } = await orgContext();
  if (!user || !org_id) return { error: "Unauthorized" };

  const id = String(noteId ?? "").trim();
  if (!id) return { error: "Missing note id" };

  const { data: noteBeforeDelete } = await supabase
    .from("congregation_notes")
    .select("image_path")
    .eq("id", id)
    .eq("org_id", org_id)
    .maybeSingle();

  const { error } = await supabase.from("congregation_notes").delete().eq("id", id).eq("org_id", org_id);
  if (error) return { error: error.message };

  const imagePath = String(noteBeforeDelete?.image_path ?? "").trim();
  if (imagePath) {
    await supabase.storage.from("congregation-note-media").remove([imagePath]);
  }

  revalidatePath("/dashboard");
  return { ok: true };
}
