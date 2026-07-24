import { redirect } from "next/navigation";
import {
  getPlatformParishOperatorOrgIds,
  getSessionUser,
  isPlatformAdmin,
} from "@/lib/auth/session";

/** Redirect unless the user is a platform admin. */
export async function requirePlatformAdmin() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const admin = await isPlatformAdmin();
  if (!admin) redirect("/dashboard");
  return user;
}

/** Platform admin or assigned parish operator. */
export async function requirePlatformAccess() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const admin = await isPlatformAdmin();
  const operatorOrgIds = await getPlatformParishOperatorOrgIds();
  if (!admin && operatorOrgIds.length === 0) redirect("/dashboard");
  return { user, isAdmin: admin, operatorOrgIds };
}

export async function canAccessPlatform(): Promise<boolean> {
  const user = await getSessionUser();
  if (!user) return false;
  const [admin, orgIds] = await Promise.all([
    isPlatformAdmin(),
    getPlatformParishOperatorOrgIds(),
  ]);
  return admin || orgIds.length > 0;
}
