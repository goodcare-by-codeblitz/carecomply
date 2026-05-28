import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getOrgRedirectPath, getUserOrganizationsResult } from "../orgs";
import { hasEnvVars } from "../utils";

const AUTH_PATHS = ["/auth"];
const AUTH_REDIRECT_PATHS = ["/auth/login", "/auth/sign-up"];
const PUBLIC_PATHS = ["/", "/pricing", "/features", "/about", "/contact", "/demo", "/security"];
const PUBLIC_PREFIXES = [
  "/api/billing/webhook",
  "/api/auth/login",
  "/api/organizations/slug-availability",
  "/api/invitations/accept",
  "/api/invitations/details",
  "/api/documents/file",
  "/api/documents/review",
  "/api/onboarding",
  "/api/references/responded",
  "/api/reminders/worker",
  "/api/settings",
  "/invite",
  "/onboarding",
];
const API_PREFIX = "/api/";
const ONBOARDING_PATHS = ["/select-org", "/create-org"];
const DASHBOARD_SECTIONS = new Set([
  "dashboard",
  "carers",
  "documents",
  "reviews",
  "automations",
  "team",
  "audit-logs",
  "settings",
]);

function redirectWithCookies(
  request: NextRequest,
  supabaseResponse: NextResponse,
  pathname: string,
) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";

  const response = NextResponse.redirect(url);
  supabaseResponse.cookies.getAll().forEach((cookie) => {
    response.cookies.set(cookie);
  });

  return response;
}

function continueWithCurrentOrg(
  supabaseResponse: NextResponse,
  orgSlug?: string,
) {
  if (orgSlug) {
    supabaseResponse.cookies.set("current_org_slug", orgSlug, {
      path: "/",
      sameSite: "lax",
      httpOnly: true,
    });
  }

  return supabaseResponse;
}

function jsonUnauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  // If the env vars are not set, skip proxy check. You can remove this
  // once you setup the project.
  if (!hasEnvVars) {
    return supabaseResponse;
  }

  // With Fluid compute, don't put this client in a global environment
  // variable. Always create a new one on each request.
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
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

  // Do not run code between createServerClient and
  // supabase.auth.getClaims(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  // IMPORTANT: If you remove getClaims() and you use server-side rendering
  // with the Supabase client, your users may be randomly logged out.
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  const pathname = request.nextUrl.pathname;
  const isAuthPath = AUTH_PATHS.some((path) => pathname.startsWith(path));
  const shouldRedirectAuthenticatedAuthPath =
    AUTH_REDIRECT_PATHS.includes(pathname);
  const isOnboardingPath = ONBOARDING_PATHS.includes(pathname);
  const isPublicPath = PUBLIC_PATHS.includes(pathname);
  const isPublicPrefix = PUBLIC_PREFIXES.some((path) => pathname.startsWith(path));
  const isApiPath = pathname.startsWith(API_PREFIX);

  if (
    !isPublicPath &&
    !isPublicPrefix &&
    !userId &&
    !isAuthPath
  ) {
    if (isApiPath) {
      return jsonUnauthorized();
    }

    // no user, potentially respond by redirecting the user to the login page
    return redirectWithCookies(request, supabaseResponse, "/auth/login");
  }

  if (
    !userId ||
    (isAuthPath && !shouldRedirectAuthenticatedAuthPath) ||
    isPublicPath ||
    isPublicPrefix
  ) {
    return supabaseResponse;
  }

  if (isApiPath) {
    return supabaseResponse;
  }

  // Platform admin bypass — check before tenant org logic runs.
  // RLS allows users to query their own platform_memberships row.
  const { data: platformMembership } = await supabase
    .from('platform_memberships')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();

  if (platformMembership) {
    // Authenticated admin visiting auth pages → redirect to admin panel
    if (shouldRedirectAuthenticatedAuthPath) {
      return redirectWithCookies(request, supabaseResponse, '/admin/reminders');
    }
    // All other paths: pass through — page-level guards on /admin/* handle protection.
    // Platform admins have no org membership so tenant logic must never run for them.
    return supabaseResponse;
  }

  const organizationsResult = await getUserOrganizationsResult(supabase, userId);

  if (!organizationsResult.ok) {
    console.error(
      "User organizations could not be loaded during middleware redirect",
      organizationsResult.error,
    );
    if (pathname === "/dashboard") {
      return redirectWithCookies(request, supabaseResponse, "/select-org");
    }
    return supabaseResponse;
  }

  const organizations = organizationsResult.organizations;
  const orgRedirectPath = getOrgRedirectPath(organizations);

  if (shouldRedirectAuthenticatedAuthPath) {
    return redirectWithCookies(request, supabaseResponse, orgRedirectPath);
  }

  if (pathname === "/dashboard") {
    return redirectWithCookies(request, supabaseResponse, orgRedirectPath);
  }

  if (isOnboardingPath) {
    return supabaseResponse;
  }

  const [, maybeOrgSlug, maybeSection] = pathname.split("/");

  if (!maybeOrgSlug || !maybeSection) {
    return supabaseResponse;
  }

  if (!DASHBOARD_SECTIONS.has(maybeSection)) {
    return supabaseResponse;
  }

  const currentOrg = organizations.find((org) => org.slug === maybeOrgSlug);

  if (!currentOrg) {
    return redirectWithCookies(request, supabaseResponse, orgRedirectPath);
  }

  // IMPORTANT: You *must* return the supabaseResponse object as it is.
  // If you're creating a new response object with NextResponse.next() make sure to:
  // 1. Pass the request in it, like so:
  //    const myNewResponse = NextResponse.next({ request })
  // 2. Copy over the cookies, like so:
  //    myNewResponse.cookies.setAll(supabaseResponse.cookies.getAll())
  // 3. Change the myNewResponse object to fit your needs, but avoid changing
  //    the cookies!
  // 4. Finally:
  //    return myNewResponse
  // If this is not done, you may be causing the browser and server to go out
  // of sync and terminate the user's session prematurely!

  return continueWithCurrentOrg(supabaseResponse, currentOrg.slug);
}
