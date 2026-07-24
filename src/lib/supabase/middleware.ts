import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", path);

  let supabaseResponse = NextResponse.next({
    request: { headers: requestHeaders },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({
            request: { headers: requestHeaders },
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  let user: Awaited<ReturnType<typeof supabase.auth.getUser>>["data"]["user"] =
    null;
  try {
    const {
      data: { user: currentUser },
    } = await supabase.auth.getUser();
    user = currentUser;
  } catch {
    request.cookies
      .getAll()
      .filter((cookie) => cookie.name.startsWith("sb-"))
      .forEach((cookie) => {
        supabaseResponse.cookies.delete(cookie.name);
      });
  }

  function copyCookies(from: NextResponse, to: NextResponse) {
    from.cookies.getAll().forEach((c) => {
      to.cookies.set(c.name, c.value);
    });
  }

  const isAuthEntry =
    path === "/login" ||
    path === "/signup" ||
    path === "/join" ||
    path.startsWith("/join/");

  // Login/signup/join: only session refresh + redirect when already signed in (no DB reads).
  if (isAuthEntry) {
    if (user) {
      const redirect = NextResponse.redirect(new URL("/dashboard", request.url));
      copyCookies(supabaseResponse, redirect);
      return redirect;
    }
    return supabaseResponse;
  }

  const needsAuth =
    path.startsWith("/dashboard") ||
    path.startsWith("/platform") ||
    path.startsWith("/regional");

  if (needsAuth && !user) {
    const redirect = NextResponse.redirect(new URL("/login", request.url));
    copyCookies(supabaseResponse, redirect);
    return redirect;
  }

  // Dashboard guards: one profile read reused for onboarding + suspension checks.
  if (
    user &&
    path.startsWith("/dashboard") &&
    path !== "/dashboard/complete-registration" &&
    !path.startsWith("/dashboard/suspended")
  ) {
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("org_id, context_org_id")
        .eq("id", user.id)
        .maybeSingle();

      const orgId = profile?.org_id ?? null;

      if (orgId) {
        const { data: platformAdmin } = await supabase
          .from("platform_admins")
          .select("user_id")
          .eq("user_id", user.id)
          .maybeSingle();

        if (!platformAdmin?.user_id) {
          const effectiveOrgId = profile?.context_org_id ?? orgId;
          const { data: org, error: orgError } = await supabase
            .from("organizations")
            .select("status")
            .eq("id", effectiveOrgId)
            .maybeSingle();

          if (!orgError && org?.status === "suspended") {
            const redirect = NextResponse.redirect(
              new URL("/dashboard/suspended", request.url),
            );
            copyCookies(supabaseResponse, redirect);
            return redirect;
          }
        }
      }
    } catch {
      /* Allow request through if guard queries fail. */
    }
  }

  return supabaseResponse;
}
