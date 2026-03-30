import type { IronSession, SessionOptions } from "iron-session";
import { getIronSession } from "iron-session"
import { cookies } from "next/headers"

if (!process.env.SESSION_SECRET) {
  throw new Error("SESSION_SECRET environment variable is not set")
}

if (process.env.SESSION_SECRET.length < 32) {
  throw new Error("SESSION_SECRET must be at least 32 characters long")
}

export const sessionOptions: SessionOptions = {
  cookieName: "daily_report_session",
  password: process.env.SESSION_SECRET,
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  },
}

export async function getSession(): Promise<IronSession<SessionData>> {
  const cookieStore = await cookies()
  return getIronSession<SessionData>(cookieStore, sessionOptions)
}
