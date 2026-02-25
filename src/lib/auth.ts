import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import { authConfig } from "./auth.config";
import { audit } from "./audit";

const MAX_FAILED_ATTEMPTS = 10;
const LOCKOUT_DURATION_MS = 30 * 60 * 1000; // 30 minutes

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, request) {
        if (!credentials?.email || !credentials?.password) return null;

        const ip = (request as Request).headers?.get?.("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        });

        if (!user || !user.passwordHash) {
          audit({ action: "LOGIN_FAILED", metadata: { email: credentials.email, reason: "user_not_found" }, ip });
          return null;
        }

        if (user.status !== "ACTIVE") {
          audit({ action: "LOGIN_FAILED", userId: user.id, metadata: { reason: "inactive" }, ip });
          return null;
        }

        // Check brute force lockout
        if (user.lockedUntil && user.lockedUntil > new Date()) {
          audit({ action: "LOGIN_FAILED", userId: user.id, metadata: { reason: "locked" }, ip });
          return null;
        }

        const isValid = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash
        );

        if (!isValid) {
          // Atomic increment to prevent race conditions
          const updated = await prisma.user.update({
            where: { id: user.id },
            data: { failedLoginAttempts: { increment: 1 } },
            select: { failedLoginAttempts: true },
          });

          if (updated.failedLoginAttempts >= MAX_FAILED_ATTEMPTS) {
            await prisma.user.update({
              where: { id: user.id },
              data: { lockedUntil: new Date(Date.now() + LOCKOUT_DURATION_MS) },
            });
          }

          audit({
            action: "LOGIN_FAILED",
            userId: user.id,
            metadata: { reason: "wrong_password", attempts: updated.failedLoginAttempts, locked: updated.failedLoginAttempts >= MAX_FAILED_ATTEMPTS },
            ip,
          });
          return null;
        }

        // Successful login - reset counter
        if (user.failedLoginAttempts > 0 || user.lockedUntil) {
          await prisma.user.update({
            where: { id: user.id },
            data: { failedLoginAttempts: 0, lockedUntil: null },
          });
        }

        audit({ action: "LOGIN_SUCCESS", userId: user.id, ip });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          status: user.status,
          language: user.language,
        };
      },
    }),
  ],
});
