import type { NextAuthConfig } from "next-auth";

// Edge-compatible auth config (no Prisma imports)
// Used by middleware for JWT validation only
export const authConfig: NextAuthConfig = {
  providers: [], // Providers are added in auth.ts (server-only)
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60,
  },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as unknown as Record<string, unknown>).role;
        token.status = (user as unknown as Record<string, unknown>).status;
        token.language = (user as unknown as Record<string, unknown>).language;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const u = session.user as any;
        u.id = token.id;
        u.role = token.role;
        u.status = token.status;
        u.language = token.language;
      }
      return session;
    },
  },
};
