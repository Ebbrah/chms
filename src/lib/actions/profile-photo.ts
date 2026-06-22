"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

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

export async function uploadMyProfilePhoto(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id")
    .eq("id", user.id)
    .single();
  const orgId = String(profile?.org_id ?? "").trim();
  if (!orgId) return { error: "Unauthorized" };

  const dataUrl = String(formData.get("photo_data_url") ?? "").trim();
  if (!dataUrl) return { error: "Please choose an image first" };
  const parsed = parseDataUrlImage(dataUrl);
  if (!parsed) return { error: "Invalid image format" };

  const { data: member } = await supabase
    .from("members")
    .select("id, member_details")
    .eq("org_id", orgId)
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const oldDetails = (member?.member_details ?? {}) as Record<string, unknown>;
  const oldPhotoPath = String(oldDetails.passport_photo_path ?? "").trim();
  const newPath = `${orgId}/${user.id}/passport-${Date.now()}.${parsed.extension}`;

  const upload = await supabase.storage
    .from("member-passports")
    .upload(newPath, parsed.bytes, { contentType: parsed.contentType, upsert: true });
  if (upload.error) return { error: upload.error.message };

  const { data } = supabase.storage.from("member-passports").getPublicUrl(newPath);
  const photoUrl = data.publicUrl;

  const { error: profileErr } = await supabase
    .from("profiles")
    .update({ avatar_url: photoUrl })
    .eq("id", user.id)
    .eq("org_id", orgId);
  if (profileErr) return { error: profileErr.message };

  if (member?.id) {
    const updatedDetails = {
      ...oldDetails,
      passport_photo_path: newPath,
      passport_photo_url: photoUrl,
    };
    const { error: memberErr } = await supabase
      .from("members")
      .update({
        member_details: JSON.parse(JSON.stringify(updatedDetails)) as Record<string, unknown>,
      })
      .eq("id", member.id)
      .eq("org_id", orgId);
    if (memberErr) return { error: memberErr.message };
  }

  if (oldPhotoPath && oldPhotoPath !== newPath) {
    await supabase.storage.from("member-passports").remove([oldPhotoPath]);
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/my-profile");
  return { ok: true, photoUrl };
}
