import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
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
            request,
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
    // Session from cookie is enough for route guards; avoids a network round-trip per navigation.
    const {
      data: { session },
    } = await supabase.auth.getSession();
    user = session?.user ?? null;
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

  const path = request.nextUrl.pathname;
  const needsAuth =
    path.startsWith("/dashboard") ||
    path.startsWith("/platform") ||
    path.startsWith("/regional");

  if (needsAuth && !user) {
    const redirect = NextResponse.redirect(new URL("/login", request.url));
    copyCookies(supabaseResponse, redirect);
    return redirect;
  }

  if (
    (path === "/login" || path === "/signup") &&
    user
  ) {
    const redirect = NextResponse.redirect(new URL("/dashboard", request.url));
    copyCookies(supabaseResponse, redirect);
    return redirect;
  }

  if ((path === "/join" || path.startsWith("/join/")) && user) {
    const redirect = NextResponse.redirect(new URL("/dashboard", request.url));
    copyCookies(supabaseResponse, redirect);
    return redirect;
  }

  // Block parish users when their org is suspended (platform admin exempt).
  if (user && path.startsWith("/dashboard") && !path.startsWith("/dashboard/suspended")) {
    try {
      const { data: platformAdmin } = await supabase
        .from("platform_admins")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!platformAdmin?.user_id) {
        let effectiveOrgId: string | null = null;

        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("org_id, context_org_id")
          .eq("id", user.id)
          .maybeSingle();

        if (!profileError && profile) {
          effectiveOrgId = profile.context_org_id ?? profile.org_id ?? null;
        } else {
          const { data: fallbackProfile } = await supabase
            .from("profiles")
            .select("org_id")
            .eq("id", user.id)
            .maybeSingle();
          effectiveOrgId = fallbackProfile?.org_id ?? null;
        }

        if (effectiveOrgId) {
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
      /* Allow request through if suspension check fails (e.g. schema lag). */
    }
  }

  return supabaseResponse;
}
