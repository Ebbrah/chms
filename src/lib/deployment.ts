/**
 * Deployment profile for the same codebase on cloud (multi-parish) vs on-prem (single parish).
 * On-prem installs set DEPLOYMENT_MODE=single-parish so users never see diocese/district pickers
 * or platform/regional admin routes.
 */
export type DeploymentMode = "platform" | "single-parish";

export function getDeploymentMode(): DeploymentMode {
  const raw = process.env.DEPLOYMENT_MODE?.trim().toLowerCase();
  if (raw === "single-parish" || raw === "single_parish") return "single-parish";
  return "platform";
}

export function isSingleParishDeployment(): boolean {
  return getDeploymentMode() === "single-parish";
}

/** Join slug for single-parish mode (e.g. `/join/klc`). */
export function getSingleParishJoinSlug(): string | null {
  const slug =
    process.env.CHMS_PARISH_SLUG?.trim() ||
    process.env.SINGLE_PARISH_JOIN_SLUG?.trim();
  if (!slug) return null;
  return slug.replace(/^\/+|\/+$/g, "");
}
