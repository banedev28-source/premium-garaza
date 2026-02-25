import { vi } from "vitest";

// ── Configurable session mock ──────────────────────────────────────
export const mockSession = {
  user: {
    id: "buyer-1",
    name: "Test Buyer",
    email: "buyer@test.rs",
    role: "BUYER" as string,
    status: "ACTIVE",
    language: "sr",
  },
};

let sessionOverride: typeof mockSession | null = null;

export function setMockSession(s: typeof mockSession | null) {
  sessionOverride = s;
}

export function resetMockSession() {
  sessionOverride = undefined as unknown as typeof mockSession | null;
  mockSession.user = {
    id: "buyer-1",
    name: "Test Buyer",
    email: "buyer@test.rs",
    role: "BUYER",
    status: "ACTIVE",
    language: "sr",
  };
}

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(() =>
    Promise.resolve(sessionOverride !== undefined ? sessionOverride : mockSession)
  ),
}));

// ── Prisma mock ────────────────────────────────────────────────────
export const mockPrisma = {
  auction: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    create: vi.fn(),
    deleteMany: vi.fn(),
  },
  bid: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    deleteMany: vi.fn(),
  },
  notification: {
    create: vi.fn(),
    createMany: vi.fn(),
    deleteMany: vi.fn(),
  },
  user: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
  },
  vehicle: {
    deleteMany: vi.fn(),
  },
  $transaction: vi.fn(),
};

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

// ── Pusher mock ────────────────────────────────────────────────────
export const mockPusher = {
  trigger: vi.fn().mockResolvedValue(undefined),
};

vi.mock("@/lib/pusher-server", () => ({
  pusher: mockPusher,
}));

// ── Audit mock ─────────────────────────────────────────────────────
vi.mock("@/lib/audit", () => ({
  audit: vi.fn(),
  getClientIp: vi.fn().mockResolvedValue("127.0.0.1"),
}));

// ── Email mock ─────────────────────────────────────────────────────
vi.mock("@/lib/email", () => ({
  sendInviteEmail: vi.fn().mockResolvedValue(undefined),
  sendAuctionWonEmail: vi.fn().mockResolvedValue(undefined),
  sendNewAuctionEmail: vi.fn().mockResolvedValue(undefined),
}));

// ── Rate limit mock ──────────────────────────────────────────────
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn().mockResolvedValue(null),
  bidLimiter: {},
  loginLimiter: {},
  inviteLimiter: {},
  uploadLimiter: {},
  publicApiLimiter: {},
}));

// ── Reset between tests ────────────────────────────────────────────
beforeEach(() => {
  vi.clearAllMocks();
  resetMockSession();
  // Default: user.findUnique returns active user (for status checks in bid/buy-now)
  mockPrisma.user.findUnique.mockResolvedValue({
    id: "buyer-1",
    status: "ACTIVE",
    role: "BUYER",
  });
});
