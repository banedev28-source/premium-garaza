import { describe, it, expect, vi } from "vitest";
import { mockSession, setMockSession, mockPrisma, mockPusher } from "./setup";

function makeRequest(body: unknown) {
  return { json: () => Promise.resolve(body) } as any;
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

function makeAuction(overrides: Record<string, unknown> = {}) {
  return {
    id: "auction-1",
    status: "DRAFT",
    auctionType: "OPEN",
    currency: "EUR",
    startingPrice: null,
    reservePrice: null,
    endTime: new Date(Date.now() + 3600000),
    vehicle: { name: "BMW 320d" },
    ...overrides,
  };
}

let PATCH: any;
beforeAll(async () => {
  // Set ADMIN session for all PATCH tests
  mockSession.user.role = "ADMIN";
  mockSession.user.id = "admin-1";
  const mod = await import("@/app/api/auctions/[id]/route");
  PATCH = mod.PATCH;
});

describe("PATCH /api/auctions/[id] - status tranzicije", () => {
  beforeEach(() => {
    mockSession.user.role = "ADMIN";
    mockSession.user.id = "admin-1";
  });

  describe("Auth", () => {
    it("samo ADMIN moze menjati status", async () => {
      mockSession.user.role = "BUYER";
      const res = await PATCH(
        makeRequest({ status: "LIVE" }),
        makeParams("auction-1")
      );
      expect(res.status).toBe(401);
    });

    it("vraca 401 bez sesije", async () => {
      setMockSession(null);
      const res = await PATCH(
        makeRequest({ status: "LIVE" }),
        makeParams("auction-1")
      );
      expect(res.status).toBe(401);
    });
  });

  describe("Validne tranzicije", () => {
    it("DRAFT → LIVE", async () => {
      mockPrisma.auction.findUnique.mockResolvedValue(
        makeAuction({ status: "DRAFT" })
      );
      mockPrisma.auction.update.mockResolvedValue(
        makeAuction({ status: "LIVE" })
      );

      const res = await PATCH(
        makeRequest({ status: "LIVE" }),
        makeParams("auction-1")
      );
      expect(res.status).toBe(200);

      // Pusher broadcast for LIVE
      expect(mockPusher.trigger).toHaveBeenCalledWith(
        "auction-auction-1",
        "auction-started",
        expect.objectContaining({ status: "LIVE" })
      );
    });

    it("DRAFT → CANCELLED", async () => {
      mockPrisma.auction.findUnique.mockResolvedValue(
        makeAuction({ status: "DRAFT" })
      );
      mockPrisma.auction.update.mockResolvedValue(
        makeAuction({ status: "CANCELLED" })
      );

      const res = await PATCH(
        makeRequest({ status: "CANCELLED" }),
        makeParams("auction-1")
      );
      expect(res.status).toBe(200);
    });

    it("LIVE → ENDED: odredjuje pobednika, salje notifikacije", async () => {
      mockPrisma.auction.findUnique.mockResolvedValue(
        makeAuction({ status: "LIVE" })
      );
      const highestBid = {
        userId: "winner-1",
        amount: { toString: () => "5000", toNumber: () => 5000 },
        user: { id: "winner-1", name: "Winner", email: "w@t.rs" },
      };
      mockPrisma.bid.findFirst.mockResolvedValue(highestBid);
      mockPrisma.auction.update.mockResolvedValue(
        makeAuction({ status: "ENDED", winnerId: "winner-1" })
      );
      mockPrisma.notification.create.mockResolvedValue({});
      mockPrisma.notification.createMany.mockResolvedValue({ count: 1 });
      mockPrisma.bid.findMany.mockResolvedValue([{ userId: "loser-1" }]);

      const res = await PATCH(
        makeRequest({ status: "ENDED" }),
        makeParams("auction-1")
      );
      expect(res.status).toBe(200);

      // Winner notification (individual create)
      expect(mockPrisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: "winner-1",
            type: "AUCTION_WON",
          }),
        })
      );

      // Loser notifications (batch createMany)
      expect(mockPrisma.notification.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({
              userId: "loser-1",
              type: "AUCTION_LOST",
            }),
          ]),
        })
      );
    });

    it("LIVE → CANCELLED", async () => {
      mockPrisma.auction.findUnique.mockResolvedValue(
        makeAuction({ status: "LIVE" })
      );
      mockPrisma.auction.update.mockResolvedValue(
        makeAuction({ status: "CANCELLED" })
      );

      const res = await PATCH(
        makeRequest({ status: "CANCELLED" }),
        makeParams("auction-1")
      );
      expect(res.status).toBe(200);
    });

    it("ENDED → ARCHIVED", async () => {
      mockPrisma.auction.findUnique.mockResolvedValue(
        makeAuction({ status: "ENDED" })
      );
      mockPrisma.auction.update.mockResolvedValue(
        makeAuction({ status: "ARCHIVED" })
      );

      const res = await PATCH(
        makeRequest({ status: "ARCHIVED" }),
        makeParams("auction-1")
      );
      expect(res.status).toBe(200);
    });
  });

  describe("Nevalidne tranzicije", () => {
    it("LIVE → DRAFT: 400", async () => {
      mockPrisma.auction.findUnique.mockResolvedValue(
        makeAuction({ status: "LIVE" })
      );

      const res = await PATCH(
        makeRequest({ status: "DRAFT" }),
        makeParams("auction-1")
      );
      expect(res.status).toBe(400);
    });

    it("ENDED → LIVE: 400", async () => {
      mockPrisma.auction.findUnique.mockResolvedValue(
        makeAuction({ status: "ENDED" })
      );

      const res = await PATCH(
        makeRequest({ status: "LIVE" }),
        makeParams("auction-1")
      );
      expect(res.status).toBe(400);
    });

    it("ENDED → DRAFT: 400", async () => {
      mockPrisma.auction.findUnique.mockResolvedValue(
        makeAuction({ status: "ENDED" })
      );

      const res = await PATCH(
        makeRequest({ status: "DRAFT" }),
        makeParams("auction-1")
      );
      expect(res.status).toBe(400);
    });

    it("CANCELLED → LIVE: 400", async () => {
      mockPrisma.auction.findUnique.mockResolvedValue(
        makeAuction({ status: "CANCELLED" })
      );

      const res = await PATCH(
        makeRequest({ status: "LIVE" }),
        makeParams("auction-1")
      );
      expect(res.status).toBe(400);
    });
  });

  describe("ENDED logika", () => {
    it("ENDED: nema pobednika kad highest bid < reservePrice", async () => {
      mockPrisma.auction.findUnique.mockResolvedValue(
        makeAuction({
          status: "LIVE",
          reservePrice: { toString: () => "10000", toNumber: () => 10000 },
        })
      );
      mockPrisma.bid.findFirst.mockResolvedValue({
        userId: "bidder-1",
        amount: { toString: () => "5000", toNumber: () => 5000 },
        user: { id: "bidder-1", name: "Bidder", email: "b@t.rs" },
      });
      mockPrisma.auction.update.mockResolvedValue(
        makeAuction({ status: "ENDED" })
      );
      mockPrisma.notification.create.mockResolvedValue({});
      mockPrisma.bid.findMany.mockResolvedValue([{ userId: "bidder-1" }]);

      await PATCH(makeRequest({ status: "ENDED" }), makeParams("auction-1"));

      expect(mockPrisma.auction.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            winnerId: null,
            finalPrice: null,
          }),
        })
      );
    });
  });
});
