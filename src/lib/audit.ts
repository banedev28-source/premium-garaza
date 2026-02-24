import { prisma } from "./prisma";
import { Prisma } from "@/generated/prisma/client";
import { headers } from "next/headers";

export type AuditAction =
  | "LOGIN_SUCCESS"
  | "LOGIN_FAILED"
  | "BID_PLACED"
  | "BUY_NOW"
  | "AUCTION_CREATED"
  | "AUCTION_STATUS_CHANGED"
  | "USER_INVITED"
  | "USER_STATUS_CHANGED"
  | "USER_DELETED"
  | "INVITE_ACCEPTED"
  | "FILE_UPLOADED";

interface AuditParams {
  action: AuditAction;
  userId?: string | null;
  targetId?: string;
  metadata?: Record<string, unknown>;
  ip?: string;
}

/**
 * Fire-and-forget audit log. Never blocks the main operation.
 */
export function audit(params: AuditParams): void {
  prisma.auditLog
    .create({
      data: {
        action: params.action,
        userId: params.userId ?? null,
        targetId: params.targetId ?? null,
        metadata: params.metadata
          ? (params.metadata as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        ip: params.ip ?? null,
      },
    })
    .catch((err) => {
      if (process.env.NODE_ENV === "development") {
        console.error("Audit log error:", err);
      }
    });
}

/**
 * Extract client IP from request headers.
 */
export async function getClientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
}
