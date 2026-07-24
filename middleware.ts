import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  // Only run auth/onboarding checks on routes that need them — skip public pages.
  matcher: [
    "/dashboard/:path*",
    "/platform/:path*",
    "/regional/:path*",
    "/login",
    "/signup",
    "/join/:path*",
  ],
};
