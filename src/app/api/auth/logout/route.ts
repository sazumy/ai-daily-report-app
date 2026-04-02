import { type NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { requireAuth, errorResponse } from "@/lib/api-helpers"

export async function DELETE(req: NextRequest): Promise<NextResponse> {
  try {
    const authResult = await requireAuth(req)
    if (authResult instanceof NextResponse) {
      return authResult
    }

    const session = await getSession()
    session.destroy()

    return new NextResponse(null, { status: 204 })
  } catch {
    return errorResponse("サーバーエラーが発生しました", 500)
  }
}
