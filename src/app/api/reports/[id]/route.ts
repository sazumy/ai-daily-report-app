import { type NextRequest, NextResponse } from "next/server"
import { requireAuth, errorResponse } from "@/lib/api-helpers"
import { prisma } from "@/lib/prisma"

type RouteParams = {
  params: Promise<{ id: string }>
}

function formatJst(date: Date): string {
  return date
    .toLocaleString("sv-SE", { timeZone: "Asia/Tokyo" })
    .replace(" ", "T")
    .concat("+09:00")
}

export async function GET(
  req: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const authResult = await requireAuth(req)
    if (authResult instanceof NextResponse) {
      return authResult
    }

    const { id } = await params
    const reportId = parseInt(id, 10)
    if (isNaN(reportId)) {
      return errorResponse("日報が見つかりません", 404)
    }

    const report = await prisma.dailyReport.findUnique({
      where: { id: BigInt(reportId) },
      include: {
        user: true,
        visitRecords: {
          include: { customer: true },
        },
        comments: {
          include: { commenter: true },
          orderBy: { createdAt: "asc" },
        },
      },
    })

    if (!report) {
      return errorResponse("日報が見つかりません", 404)
    }

    const responseReport = {
      id: Number(report.id),
      report_date: report.reportDate.toISOString().split("T")[0],
      user: {
        id: Number(report.user.id),
        name: report.user.name,
      },
      visit_records: report.visitRecords.map((vr) => ({
        id: Number(vr.id),
        customer: {
          id: Number(vr.customer.id),
          name: vr.customer.name,
          company_name: vr.customer.companyName,
        },
        content: vr.content,
      })),
      problem: report.problem,
      plan: report.plan,
      comments: report.comments.map((c) => ({
        id: Number(c.id),
        commenter: {
          id: Number(c.commenter.id),
          name: c.commenter.name,
        },
        body: c.body,
        created_at: formatJst(c.createdAt),
      })),
      created_at: formatJst(report.createdAt),
      updated_at: formatJst(report.updatedAt),
    }

    return NextResponse.json({ report: responseReport }, { status: 200 })
  } catch {
    return errorResponse("サーバーエラーが発生しました", 500)
  }
}
