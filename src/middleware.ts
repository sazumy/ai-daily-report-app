import { type NextRequest, NextResponse } from "next/server"
import { SESSION_COOKIE_NAME } from "@/lib/session"

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl

  // セッションCookieの存在をチェックしてログイン状態を判定
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)
  const isLoggedIn = Boolean(sessionCookie?.value)

  const isLoginPage = pathname === "/login"

  if (isLoginPage) {
    // ログイン済みの場合は /reports へリダイレクト（SCR-1-6）
    if (isLoggedIn) {
      return NextResponse.redirect(new URL("/reports", request.url))
    }
    return NextResponse.next()
  }

  // それ以外のページ: 未ログインの場合は /login へリダイレクト（SCR-1-7）
  if (!isLoggedIn) {
    return NextResponse.redirect(new URL("/login", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
}
