import { NextResponse, type NextRequest } from "next/server";
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico" ||
    pathname === "/robots.txt"
  ) {
    return NextResponse.next();
  }
  return new NextResponse(
    `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>403 Forbidden</title>
<style>
  body { font-family: system-ui, -apple-system, sans-serif; background: #f5f5f5; color: #1e3932; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
  .box { text-align: center; padding: 2rem; }
  h1 { font-size: 4rem; margin: 0 0 0.5rem; color: #00704A; }
  p { color: #6b6b6b; margin: 0; }
</style>
</head>
<body>
  <div class="box">
    <h1>403</h1>
    <p>Forbidden</p>
  </div>
</body>
</html>`,
    {
      status: 403,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    }
  );
}
export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
