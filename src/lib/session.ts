import type { IronSession, SessionOptions } from "iron-session"
import { getIronSession } from "iron-session"
import { cookies } from "next/headers"

export const SESSION_COOKIE_NAME = "daily_report_session"

function getSessionOptions(): SessionOptions {
  const secret = process.env.SESSION_SECRET
  if (!secret) {
    throw new Error("SESSION_SECRET environment variable is not set")
  }
  if (secret.length < 32) {
    throw new Error("SESSION_SECRET must be at least 32 characters long")
  }
  return {
    cookieName: SESSION_COOKIE_NAME,
    password: secret,
    cookieOptions: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
    },
  }
}

export async function getSession(): Promise<IronSession<SessionData>> {
  const cookieStore = await cookies()
  return getIronSession<SessionData>(cookieStore, getSessionOptions())
}
