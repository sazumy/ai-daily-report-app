interface SessionData {
  user?: {
    id: number
    name: string
    email: string
    role: "salesperson" | "manager"
  }
}
