import { type NextRequest, NextResponse } from "next/server"
import { requireAuth, errorResponse } from "@/lib/api-helpers"

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const authResult = await requireAuth(req)
    if (authResult instanceof NextResponse) {
      return authResult
    }

    return NextResponse.json({ user: authResult }, { status: 200 })
  } catch {
    return errorResponse("サーバーエラーが発生しました", 500)
  }
}
