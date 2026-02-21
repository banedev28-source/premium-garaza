import type { Role, UserStatus } from "@/generated/prisma/client";
import "next-auth";

declare module "next-auth" {
  interface User {
    role?: Role;
    status?: UserStatus;
    language?: string;
  }
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      role: Role;
      status: UserStatus;
      language: string;
    };
  }
}
