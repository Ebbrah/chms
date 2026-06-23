"use server";

import { revalidatePath } from "next/cache";
import { isPlatformAdmin } from "@/lib/auth/session";
import type { DioceseOfficerRole, DistrictOfficerRole } from "@/lib/auth/regional-guard";
import { createClient } from "@/lib/supabase/server";

async function requireAdmin() {
  if (!(await isPlatformAdmin())) return { error: "Platform admin only" } as const;
  return { ok: true } as const;
}

export async function assignDioceseOfficer(formData: FormData) {
  const gate = await requireAdmin();
  if ("error" in gate) return gate;

  const dioceseId = String(formData.get("diocese_id") ?? "").trim();
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const role = String(formData.get("role") ?? "").trim() as DioceseOfficerRole;

  if (!dioceseId || !email || !role) return { error: "Dayosisi, email, and role are required" };

  const supabase = await createClient();
  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("id")
    .ilike("email", email)
    .maybeSingle();

  if (profileErr) return { error: profileErr.message };
  if (!profile?.id) {
    return { error: "No account found for that email. Ask them to sign up first." };
  }

  const { error } = await supabase.rpc("assign_diocese_officer", {
    _diocese_id: dioceseId,
    _user_id: profile.id,
    _role: role,
  });
  if (error) return { error: error.message };

  revalidatePath("/platform/officers");
  return { ok: true };
}

export async function assignDistrictOfficer(formData: FormData) {
  const gate = await requireAdmin();
  if ("error" in gate) return gate;

  const districtId = String(formData.get("district_id") ?? "").trim();
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const role = String(formData.get("role") ?? "").trim() as DistrictOfficerRole;

  if (!districtId || !email || !role) return { error: "Jimbo, email, and role are required" };

  const supabase = await createClient();
  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("id")
    .ilike("email", email)
    .maybeSingle();

  if (profileErr) return { error: profileErr.message };
  if (!profile?.id) {
    return { error: "No account found for that email. Ask them to sign up first." };
  }

  const { error } = await supabase.rpc("assign_district_officer", {
    _district_id: districtId,
    _user_id: profile.id,
    _role: role,
  });
  if (error) return { error: error.message };

  revalidatePath("/platform/officers");
  return { ok: true };
}

export async function removeDioceseOfficer(officerId: string) {
  const gate = await requireAdmin();
  if ("error" in gate) return gate;

  const supabase = await createClient();
  const { error } = await supabase.rpc("remove_diocese_officer", { _officer_id: officerId });
  if (error) return { error: error.message };

  revalidatePath("/platform/officers");
  return { ok: true };
}

export async function removeDistrictOfficer(officerId: string) {
  const gate = await requireAdmin();
  if ("error" in gate) return gate;

  const supabase = await createClient();
  const { error } = await supabase.rpc("remove_district_officer", { _officer_id: officerId });
  if (error) return { error: error.message };

  revalidatePath("/platform/officers");
  return { ok: true };
}

export async function searchMemberRegistry(scopeType: string, scopeId: string, query: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("search_member_registry", {
    _scope_type: scopeType,
    _scope_id: scopeId,
    _query: query.trim(),
  });
  if (error) return { error: error.message };
  return { ok: true, results: data ?? [] };
}
