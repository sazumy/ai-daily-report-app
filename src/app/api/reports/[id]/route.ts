import { type NextRequest, NextResponse } from "next/server"
import { requireAuth, errorResponse, validationError } from "@/lib/api-helpers"
import { prisma } from "@/lib/prisma"

type RouteContext = {
  params: Promise<{ id: string }>
}

type ReportWithRelations = NonNullable<
  Awaited<ReturnType<typeof fetchReportById>>
>

async function fetchReportById(id: bigint) {
  return prisma.dailyReport.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true } },
      visitRecords: {
        include: {
          customer: { select: { id: true, name: true, companyName: true } },
        },
        orderBy: { id: "asc" },
      },
      comments: {
        include: {
          commenter: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  })
}

function formatReport(report: ReportWithRelations) {
  return {
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
      created_at: c.createdAt.toISOString(),
    })),
    created_at: report.createdAt.toISOString(),
    updated_at: report.updatedAt.toISOString(),
  }
}

export async function GET(
  req: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    const authResult = await requireAuth(req)
    if (authResult instanceof NextResponse) {
      return authResult
    }

    const { id: idParam } = await context.params
    const id = parseInt(idParam, 10)
    if (isNaN(id)) {
      return errorResponse("日報が見つかりません", 404)
    }

    const report = await fetchReportById(BigInt(id))
    if (!report) {
      return errorResponse("日報が見つかりません", 404)
    }

    return NextResponse.json({ report: formatReport(report) }, { status: 200 })
  } catch {
    return errorResponse("サーバーエラーが発生しました", 500)
  }
}

type VisitRecordInput = {
  id?: number
  customer_id?: number
  content?: string
}

export async function PATCH(
  req: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    const authResult = await requireAuth(req)
    if (authResult instanceof NextResponse) {
      return authResult
    }
    const user = authResult as NonNullable<SessionData["user"]>

    // 営業担当者のみ実行可能
    if (user.role !== "salesperson") {
      return errorResponse("この操作を行う権限がありません", 403)
    }

    const { id: idParam } = await context.params
    const id = parseInt(idParam, 10)
    if (isNaN(id)) {
      return errorResponse("日報が見つかりません", 404)
    }

    // 日報を取得（既存の訪問記録IDも一緒に）
    const report = await prisma.dailyReport.findUnique({
      where: { id: BigInt(id) },
      include: {
        visitRecords: { select: { id: true } },
      },
    })

    if (!report) {
      return errorResponse("日報が見つかりません", 404)
    }

    // 自分の日報のみ更新可能
    if (Number(report.userId) !== user.id) {
      return errorResponse("この操作を行う権限がありません", 403)
    }

    // リクエストボディのパース
    const body = await req.json()
    const visitRecords: VisitRecordInput[] = Array.isArray(body.visit_records)
      ? body.visit_records
      : []
    const problem: string | undefined = body.problem
    const plan: string | undefined = body.plan

    const errors: { field: string; message: string }[] = []

    // problem バリデーション
    if (problem !== undefined && problem !== null && problem.length > 2000) {
      errors.push({
        field: "problem",
        message: "Problemは2000文字以内で入力してください",
      })
    }

    // plan バリデーション
    if (plan !== undefined && plan !== null && plan.length > 2000) {
      errors.push({
        field: "plan",
        message: "Planは2000文字以内で入力してください",
      })
    }

    // 自分の日報に紐づく訪問記録IDのセット
    const ownVisitRecordIds = new Set(
      report.visitRecords.map((vr) => Number(vr.id))
    )

    // customer_id の存在確認用リスト
    const customerIdsToCheck: bigint[] = []

    // visit_records バリデーション
    for (let i = 0; i < visitRecords.length; i++) {
      const vr = visitRecords[i]

      // id が指定されている場合、自分の日報に紐づくIDか確認
      if (vr.id !== undefined && vr.id !== null) {
        if (!ownVisitRecordIds.has(Number(vr.id))) {
          errors.push({
            field: `visit_records[${i}].id`,
            message: "指定された訪問記録IDが無効です",
          })
        }
      }

      // customer_id の必須チェック
      if (vr.customer_id === undefined || vr.customer_id === null) {
        errors.push({
          field: `visit_records[${i}].customer_id`,
          message: "顧客を選択してください",
        })
      } else {
        customerIdsToCheck.push(BigInt(vr.customer_id))
      }

      // content のバリデーション
      if (!vr.content || vr.content.length === 0) {
        errors.push({
          field: `visit_records[${i}].content`,
          message: "訪問内容を入力してください",
        })
      } else if (vr.content.length > 1000) {
        errors.push({
          field: `visit_records[${i}].content`,
          message: "訪問内容は1000文字以内で入力してください",
        })
      }
    }

    // customer_id の存在チェック（早期リターンのためエラーがない場合のみ）
    if (customerIdsToCheck.length > 0) {
      const existingCustomers = await prisma.customer.findMany({
        where: { id: { in: customerIdsToCheck } },
        select: { id: true },
      })
      const existingCustomerIdSet = new Set(
        existingCustomers.map((c) => Number(c.id))
      )

      for (let i = 0; i < visitRecords.length; i++) {
        const vr = visitRecords[i]
        if (
          vr.customer_id !== undefined &&
          vr.customer_id !== null &&
          !existingCustomerIdSet.has(Number(vr.customer_id))
        ) {
          errors.push({
            field: `visit_records[${i}].customer_id`,
            message: "指定された顧客が存在しません",
          })
        }
      }
    }

    if (errors.length > 0) {
      return validationError(errors)
    }

    // 洗い替えロジック: リクエストに含まれないIDを削除
    const requestedIds = new Set(
      visitRecords
        .filter((vr) => vr.id !== undefined && vr.id !== null)
        .map((vr) => Number(vr.id))
    )
    const idsToDelete = [...ownVisitRecordIds].filter(
      (id) => !requestedIds.has(id)
    )

    await prisma.$transaction(async (tx) => {
      // 削除
      if (idsToDelete.length > 0) {
        await tx.visitRecord.deleteMany({
          where: { id: { in: idsToDelete.map(BigInt) } },
        })
      }

      // 更新 & 新規作成
      for (const vr of visitRecords) {
        if (vr.id !== undefined && vr.id !== null) {
          // 既存レコードの更新
          await tx.visitRecord.update({
            where: { id: BigInt(vr.id) },
            data: {
              customerId: BigInt(vr.customer_id!),
              content: vr.content!,
            },
          })
        } else {
          // 新規作成
          await tx.visitRecord.create({
            data: {
              dailyReportId: BigInt(id),
              customerId: BigInt(vr.customer_id!),
              content: vr.content!,
            },
          })
        }
      }

      // 日報の更新
      await tx.dailyReport.update({
        where: { id: BigInt(id) },
        data: {
          problem: problem !== undefined ? problem : report.problem,
          plan: plan !== undefined ? plan : report.plan,
        },
      })
    })

    // 更新後の日報を取得して返す
    const updatedReport = await fetchReportById(BigInt(id))
    return NextResponse.json(
      { report: formatReport(updatedReport!) },
      { status: 200 }
    )
  } catch {
    return errorResponse("サーバーエラーが発生しました", 500)
  }
}
