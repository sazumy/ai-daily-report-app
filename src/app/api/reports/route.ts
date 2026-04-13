import { type NextRequest, NextResponse } from "next/server"
import { requireAuth, requireRole, errorResponse, validationError } from "@/lib/api-helpers"
import { prisma } from "@/lib/prisma"

type VisitRecordInput = {
  customer_id: unknown
  content: unknown
}

type CreateReportBody = {
  report_date?: unknown
  visit_records?: unknown
  problem?: unknown
  plan?: unknown
}

/**
 * JST (UTC+9) でのYYYY-MM-DD文字列を返す
 */
function getTodayJST(): string {
  const now = new Date()
  // UTC+9 に変換
  const jstOffset = 9 * 60 * 60 * 1000
  const jstDate = new Date(now.getTime() + jstOffset)
  return jstDate.toISOString().split("T")[0]
}

/**
 * DateオブジェクトをISO 8601形式（JST+09:00）の文字列に変換する
 */
function toJSTISOString(date: Date): string {
  const jstOffset = 9 * 60 * 60 * 1000
  const jstDate = new Date(date.getTime() + jstOffset)
  const isoStr = jstDate.toISOString().replace("Z", "+09:00")
  return isoStr
}

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

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    // 認証チェック
    const authResult = await requireAuth(req)
    if (authResult instanceof NextResponse) {
      return authResult
    }
    const user = authResult as NonNullable<SessionData["user"]>

    // 権限チェック: salesperson のみ
    const roleError = requireRole(user, "salesperson")
    if (roleError) {
      return roleError
    }

    // リクエストボディのパース
    let body: CreateReportBody
    try {
      body = (await req.json()) as CreateReportBody
    } catch {
      return errorResponse("リクエストボディが不正です", 400)
    }

    const { report_date, visit_records, problem, plan } = body

    // バリデーション
    const details: { field: string; message: string }[] = []

    // report_date バリデーション
    if (!report_date || typeof report_date !== "string" || report_date.trim() === "") {
      details.push({ field: "report_date", message: "日付を入力してください" })
    } else {
      // YYYY-MM-DD形式チェック
      const dateFormatRegex = /^\d{4}-\d{2}-\d{2}$/
      if (!dateFormatRegex.test(report_date)) {
        details.push({ field: "report_date", message: "日付はYYYY-MM-DD形式で入力してください" })
      } else {
        // 本日の日付のみ受け付ける（JST基準）
        const todayJST = getTodayJST()
        if (report_date !== todayJST) {
          details.push({ field: "report_date", message: "日付は本日の日付のみ指定できます" })
        }
      }
    }

    // visit_records バリデーション
    const visitRecordsRaw = visit_records
    let parsedVisitRecords: VisitRecordInput[] = []
    if (visitRecordsRaw !== undefined && visitRecordsRaw !== null) {
      if (!Array.isArray(visitRecordsRaw)) {
        details.push({ field: "visit_records", message: "訪問記録は配列で指定してください" })
      } else {
        parsedVisitRecords = visitRecordsRaw as VisitRecordInput[]
        for (let i = 0; i < parsedVisitRecords.length; i++) {
          const record = parsedVisitRecords[i]
          // customer_id チェック
          if (record.customer_id === undefined || record.customer_id === null) {
            details.push({
              field: `visit_records[${i}].customer_id`,
              message: "顧客を選択してください",
            })
          } else if (
            typeof record.customer_id !== "number" ||
            !Number.isInteger(record.customer_id)
          ) {
            details.push({
              field: `visit_records[${i}].customer_id`,
              message: "顧客IDが不正です",
            })
          }
          // content チェック
          if (record.content === undefined || record.content === null || record.content === "") {
            details.push({
              field: `visit_records[${i}].content`,
              message: "訪問内容を入力してください",
            })
          } else if (typeof record.content !== "string") {
            details.push({
              field: `visit_records[${i}].content`,
              message: "訪問内容が不正です",
            })
          } else if (record.content.length > 1000) {
            details.push({
              field: `visit_records[${i}].content`,
              message: "訪問内容は1000文字以内で入力してください",
            })
          }
        }
      }
    }

    // problem バリデーション
    if (problem !== undefined && problem !== null) {
      if (typeof problem !== "string") {
        details.push({ field: "problem", message: "Problemが不正です" })
      } else if (problem.length > 2000) {
        details.push({ field: "problem", message: "Problemは2000文字以内で入力してください" })
      }
    }

    // plan バリデーション
    if (plan !== undefined && plan !== null) {
      if (typeof plan !== "string") {
        details.push({ field: "plan", message: "Planが不正です" })
      } else if (plan.length > 2000) {
        details.push({ field: "plan", message: "Planは2000文字以内で入力してください" })
      }
    }

    // バリデーションエラーがあれば400を返す
    if (details.length > 0) {
      return validationError(details)
    }

    // customer_id の存在確認（バリデーション通過後）
    const customerIdErrors: { field: string; message: string }[] = []
    for (let i = 0; i < parsedVisitRecords.length; i++) {
      const record = parsedVisitRecords[i]
      const customerId = record.customer_id as number
      const customerCount = await prisma.customer.count({
        where: { id: BigInt(customerId) },
      })
      if (customerCount === 0) {
        customerIdErrors.push({
          field: `visit_records[${i}].customer_id`,
          message: "指定された顧客が存在しません",
        })
      }
    }
    if (customerIdErrors.length > 0) {
      return validationError(customerIdErrors)
    }

    // 当日の日報が既に存在するか確認（422）
    const reportDateStr = report_date as string
    // report_date を Date オブジェクトに変換（UTC 0時として扱う）
    const reportDateObj = new Date(`${reportDateStr}T00:00:00.000Z`)
    const existingReport = await prisma.dailyReport.findUnique({
      where: {
        userId_reportDate: {
          userId: BigInt(user.id),
          reportDate: reportDateObj,
        },
      },
    })
    if (existingReport) {
      return errorResponse("本日の日報は既に作成されています", 422)
    }

    // 日報をトランザクションで作成
    const createdReport = await prisma.$transaction(async (tx) => {
      const report = await tx.dailyReport.create({
        data: {
          userId: BigInt(user.id),
          reportDate: reportDateObj,
          problem: typeof problem === "string" ? problem : null,
          plan: typeof plan === "string" ? plan : null,
          visitRecords: {
            create: parsedVisitRecords.map((record) => ({
              customerId: BigInt(record.customer_id as number),
              content: record.content as string,
            })),
          },
        },
        include: {
          user: {
            select: { id: true, name: true },
          },
          visitRecords: {
            include: {
              customer: {
                select: { id: true, name: true, companyName: true },
              },
            },
            orderBy: { id: "asc" },
          },
          comments: {
            include: {
              commenter: {
                select: { id: true, name: true },
              },
            },
            orderBy: { createdAt: "asc" },
          },
        },
      })
      return report
    })

    // レスポンス整形
    const responseReport = {
      id: Number(createdReport.id),
      report_date: createdReport.reportDate.toISOString().split("T")[0],
      user: {
        id: Number(createdReport.user.id),
        name: createdReport.user.name,
      },
      visit_records: createdReport.visitRecords.map((vr) => ({
        id: Number(vr.id),
        customer: {
          id: Number(vr.customer.id),
          name: vr.customer.name,
          company_name: vr.customer.companyName,
        },
        content: vr.content,
      })),
      problem: createdReport.problem,
      plan: createdReport.plan,
      comments: createdReport.comments.map((c) => ({
        id: Number(c.id),
        commenter: {
          id: Number(c.commenter.id),
          name: c.commenter.name,
        },
        body: c.body,
        created_at: toJSTISOString(c.createdAt),
      })),
      created_at: toJSTISOString(createdReport.createdAt),
      updated_at: toJSTISOString(createdReport.updatedAt),
    }

    return NextResponse.json({ report: responseReport }, { status: 201 })
  } catch {
    return errorResponse("サーバーエラーが発生しました", 500)
  }
}
