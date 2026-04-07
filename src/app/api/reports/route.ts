import { type NextRequest, NextResponse } from "next/server"
import { requireAuth, errorResponse, validationError } from "@/lib/api-helpers"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const authResult = await requireAuth(req)
    if (authResult instanceof NextResponse) {
      return authResult
    }
    const user = authResult as NonNullable<SessionData["user"]>

    const { searchParams } = req.nextUrl
    const from = searchParams.get("from")
    const to = searchParams.get("to")
    const userIdParam = searchParams.get("user_id")

    // from > to バリデーション
    if (from && to && from > to) {
      return validationError([
        {
          field: "from",
          message: "開始日は終了日以前の日付を入力してください",
        },
      ])
    }

    // 日付フィルタ条件
    const dateFilter: { gte?: Date; lte?: Date } = {}
    if (from) {
      dateFilter.gte = new Date(from)
    }
    if (to) {
      const toDate = new Date(to)
      toDate.setHours(23, 59, 59, 999)
      dateFilter.lte = toDate
    }

    // ロール別 where 条件
    const where: {
      reportDate?: { gte?: Date; lte?: Date }
      userId?: bigint
    } = {}

    if (Object.keys(dateFilter).length > 0) {
      where.reportDate = dateFilter
    }

    if (user.role === "salesperson") {
      // 営業担当者: 自分の日報のみ（user_id は無視）
      where.userId = BigInt(user.id)
    } else if (user.role === "manager" && userIdParam) {
      // 上長: user_id フィルタが指定されていれば適用
      const parsedUserId = parseInt(userIdParam, 10)
      if (!isNaN(parsedUserId)) {
        where.userId = BigInt(parsedUserId)
      }
    }

    const reports = await prisma.dailyReport.findMany({
      where,
      orderBy: { reportDate: "desc" },
      select: {
        id: true,
        reportDate: true,
        problem: true,
        user: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: { comments: true },
        },
      },
    })

    const responseReports = reports.map((report) => ({
      id: Number(report.id),
      report_date: report.reportDate.toISOString().split("T")[0],
      user: {
        id: Number(report.user.id),
        name: report.user.name,
      },
      problem: report.problem,
      comments_count: report._count.comments,
    }))

    return NextResponse.json({ reports: responseReports }, { status: 200 })
  } catch {
    return errorResponse("サーバーエラーが発生しました", 500)
  }
}
