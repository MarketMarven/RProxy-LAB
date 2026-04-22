// ============================================
// Geo-blocking Middleware - CIS Countries
// ============================================

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const CIS_COUNTRIES = [
  'RU',
  'BY',
  'KZ',
  'UZ',
  'UA',
  'AZ',
  'AM',
  'GE',
  'MD',
  'TJ',
  'TM',
  'KG',
]
export function middleware(request: NextRequest) {
  if (process.env.NODE_ENV === 'development') {
    return NextResponse.next()
  }

  const country = request.geo?.country || request.headers.get('x-vercel-ip-country') || ''

  if (!country) {
    return NextResponse.next()
  }

  if (CIS_COUNTRIES.includes(country.toUpperCase())) {
    return new NextResponse(
      `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Access Denied | NEAT Protocol</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #0a0a0a 100%);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #fff;
      padding: 20px;
    }
    .container {
      text-align: center;
      max-width: 500px;
    }
    .icon {
      font-size: 80px;
      margin-bottom: 24px;
      opacity: 0.8;
    }
    h1 {
      font-size: 28px;
      font-weight: 700;
      margin-bottom: 16px;
      background: linear-gradient(90deg, #fff, #a78bfa);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    p {
      font-size: 16px;
      color: rgba(255,255,255,0.6);
      line-height: 1.6;
      margin-bottom: 12px;
    }
    .code {
      display: inline-block;
      background: rgba(255,255,255,0.1);
      padding: 8px 16px;
      border-radius: 8px;
      font-family: monospace;
      font-size: 14px;
      color: rgba(255,255,255,0.5);
      margin-top: 24px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">🚫</div>
    <h1>Access Restricted</h1>
    <p>This service is not available in your region.</p>
    <p>Please use a VPN or try accessing from a different location.</p>
    <div class="code">Error: GEO_BLOCK_CIS</div>
  </div>
</body>
</html>`,
      {
        status: 403,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'X-Blocked-Country': country,
        },
      }
    )
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
