/**
 * Maps Prisma / network failures (unreachable DB, pooler down, etc.) to a stable
 * application error so routes can return 503 and pages can render a calm message
 * instead of a development stack trace.
 */

export class DatabaseUnavailableError extends Error {
  readonly status = 503;

  constructor(
    message = "The database is temporarily unavailable. Please try again shortly.",
  ) {
    super(message);
    this.name = "DatabaseUnavailableError";
  }
}

export function isDatabaseUnreachableError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as {
    name?: string;
    code?: string;
    message?: string;
    constructor?: { name?: string };
  };
  const ctor = e.constructor?.name ?? "";
  if (ctor === "PrismaClientInitializationError") return true;
  if (ctor === "PrismaClientRustPanicError") return true;
  if (ctor === "PrismaClientKnownRequestError" && e.code === "P1001") return true;
  if (e.code === "P1001") return true;

  const msg = typeof e.message === "string" ? e.message : "";
  if (msg.includes("Can't reach database server")) return true;
  if (msg.includes("Database server is not reachable")) return true;
  if (msg.includes("Connection terminated unexpectedly")) return true;
  if (msg.includes("connect ECONNREFUSED")) return true;
  if (msg.includes("ETIMEDOUT")) return true;
  if (msg.includes("ENOTFOUND")) return true;
  return false;
}

export function asDatabaseUnavailableError(error: unknown): DatabaseUnavailableError | null {
  if (error instanceof DatabaseUnavailableError) return error;
  if (isDatabaseUnreachableError(error)) return new DatabaseUnavailableError();
  return null;
}

export function toDatabaseErrorResponse(
  error: unknown,
): { status: number; detail: string } | null {
  const mapped = asDatabaseUnavailableError(error);
  if (!mapped) return null;
  return { status: mapped.status, detail: mapped.message };
}
