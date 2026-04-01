import bcrypt from "bcryptjs"
import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/session"
import { validationError, errorResponse } from "@/lib/api-helpers"

type ErrorDetail = {
  field: string
  message: string
}

function validateLoginInput(body: unknown): {
  valid: boolean
  details: ErrorDetail[]
  email?: string
  password?: string
} {
  const details: ErrorDetail[] = []

  if (typeof body !== "object" || body === null) {
    return { valid: false, details: [{ field: "email", message: "メールアドレスを入力してください" }] }
  }

  const { email, password } = body as Record<string, unknown>

  if (typeof email !== "string" || email.trim() === "") {
    details.push({ field: "email", message: "メールアドレスを入力してください" })
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    details.push({ field: "email", message: "メールアドレスの形式が正しくありません" })
  }

  if (typeof password !== "string" || password === "") {
    details.push({ field: "password", message: "パスワードを入力してください" })
  }

  if (details.length > 0) {
    return { valid: false, details }
  }

  return { valid: true, details: [], email: email as string, password: password as string }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    let body: unknown
    try {
      body = await req.json()
    } catch {
      return validationError([{ field: "email", message: "メールアドレスを入力してください" }])
    }

    const validation = validateLoginInput(body)
    if (!validation.valid) {
      return validationError(validation.details)
    }

    const { email, password } = validation as { email: string; password: string }

    const user = await prisma.user.findUnique({
      where: { email },
    })

    const invalidCredentialsResponse = errorResponse(
      "メールアドレスまたはパスワードが正しくありません",
      401
    )

    if (!user) {
      return invalidCredentialsResponse
    }

    const passwordMatch = await bcrypt.compare(password, user.passwordHash)
    if (!passwordMatch) {
      return invalidCredentialsResponse
    }

    const sessionUser: SessionData["user"] = {
      id: Number(user.id),
      name: user.name,
      email: user.email,
      role: user.role,
    }

    const session = await getSession()
    session.user = sessionUser
    await session.save()

    return NextResponse.json({ user: sessionUser }, { status: 200 })
  } catch {
    return errorResponse("サーバーエラーが発生しました", 500)
  }
}
