import { type NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"

type ErrorDetail = {
  field: string
  message: string
}

/**
 * 共通エラーレスポンスを生成する
 */
export function errorResponse(message: string, status: number): NextResponse {
  return NextResponse.json(
    {
      error: {
        message,
      },
    },
    { status }
  )
}

/**
 * バリデーションエラーレスポンスを生成する（400 Bad Request）
 */
export function validationError(details: ErrorDetail[]): NextResponse {
  return NextResponse.json(
    {
      error: {
        message: "入力内容に誤りがあります",
        details,
      },
    },
    { status: 400 }
  )
}

/**
 * 認証チェックを行う。
 * ログイン済みの場合はユーザー情報を返す。
 * 未ログインの場合は 401 レスポンスを返す。
 */
export async function requireAuth(
  _req: NextRequest
): Promise<SessionData["user"] | NextResponse> {
  const session = await getSession()

  if (!session.user) {
    return errorResponse("ログインが必要です", 401)
  }

  return session.user
}

/**
 * ロールチェックを行う。
 * ロールが一致しない場合は 403 レスポンスを返す。
 * 一致する場合は null を返す。
 */
export function requireRole(
  user: NonNullable<SessionData["user"]>,
  role: "salesperson" | "manager"
): NextResponse | null {
  if (user.role !== role) {
    return errorResponse("この操作を行う権限がありません", 403)
  }

  return null
}
