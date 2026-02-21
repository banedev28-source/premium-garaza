import { describe, it, expect, vi } from "vitest";
import { mockSession, setMockSession, mockPrisma, mockPusher } from "./setup";

// Helper: create a NextRequest-like object
function makeRequest(body: unknown) {
  return {
    json: () => Promise.resolve(body),
  } as any;
}

// Helper: params promise
function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

// Helper: make a mock auction
function makeAuction(overrides: Record<string, unknown> = {}) {
  return {
    id: "auction-1",
    status: "LIVE",
    auctionType: "OPEN",
    currency: "EUR",
    startingPrice: { toString: () => "100", toNumber: () => 100 },
    reservePrice: null,
    endTime: new Date(Date.now() + 3600000), // 1 hour from now
    startTime: new Date(Date.now() - 3600000),
    showBidCount: true,
    buyNowEnabled: false,
    buyNowPrice: null,
    vehicle: { name: "BMW 320d" },
    ...overrides,
  };
}

// Helper: make a mock bid
function makeBid(overrides: Record<string, unknown> = {}) {
  return {
    id: "bid-1",
    auctionId: "auction-1",
    userId: "buyer-1",
    amount: { toString: () => "500", toNumber: () => 500 },
    isBuyNow: false,
    createdAt: new Date("2025-01-01T12:00:00Z"),
    user: { id: "buyer-1", name: "Test Buyer" },
    ...overrides,
  };
}

// Dynamically import the route handler (after mocks are set up)
let POST: any;
beforeAll(async () => {
  const mod = await import("@/app/api/auctions/[id]/bid/route");
  POST = mod.POST;
});

// Helper: set up $transaction to execute the callback with mockPrisma as tx
function setupTransaction() {
  mockPrisma.$transaction.mockImplementation(async (cb: any) => {
    return cb(mockPrisma);
  });
}

describe("POST /api/auctions/[id]/bid", () => {
  // ── Auth & Role ──────────────────────────────────────────────────

  describe("Auth & Role", () => {
    it("vraca 401 ako nema sesije", async () => {
      setMockSession(null);
      const res = await POST(makeRequest({ amount: 500 }), makeParams("auction-1"));
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toBe("Unauthorized");
    });

    it("vraca 403 ako je ADMIN (samo BUYER moze)", async () => {
      mockSession.user.role = "ADMIN";
      const res = await POST(makeRequest({ amount: 500 }), makeParams("auction-1"));
      expect(res.status).toBe(403);
    });
  });

  // ── Validacija ───────────────────────────────────────────────────

  describe("Validacija", () => {
    it("vraca 400 za negativan amount", async () => {
      const res = await POST(makeRequest({ amount: -100 }), makeParams("auction-1"));
      expect(res.status).toBe(400);
    });

    it("vraca 400 za amount = 0", async () => {
      const res = await POST(makeRequest({ amount: 0 }), makeParams("auction-1"));
      expect(res.status).toBe(400);
    });

    it("vraca 400 za string amount", async () => {
      const res = await POST(makeRequest({ amount: "abc" }), makeParams("auction-1"));
      expect(res.status).toBe(400);
    });

    it("vraca 400 ako aukcija ne postoji", async () => {
      setupTransaction();
      mockPrisma.auction.findUnique.mockResolvedValue(null);

      const res = await POST(makeRequest({ amount: 500 }), makeParams("auction-1"));
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("pronadjena");
    });

    it("vraca 400 ako aukcija nije LIVE", async () => {
      setupTransaction();
      mockPrisma.auction.findUnique.mockResolvedValue(
        makeAuction({ status: "DRAFT" })
      );

      const res = await POST(makeRequest({ amount: 500 }), makeParams("auction-1"));
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("aktivna");
    });

    it("vraca 400 ako je aukcija istekla (endTime < now)", async () => {
      setupTransaction();
      mockPrisma.auction.findUnique.mockResolvedValue(
        makeAuction({ endTime: new Date(Date.now() - 1000) })
      );

      const res = await POST(makeRequest({ amount: 500 }), makeParams("auction-1"));
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("istekla");
    });

    it("vraca 400 ako je amount < startingPrice", async () => {
      setupTransaction();
      mockPrisma.auction.findUnique.mockResolvedValue(
        makeAuction({ startingPrice: { toString: () => "1000", toNumber: () => 1000 } })
      );
      mockPrisma.bid.findFirst.mockResolvedValue(null);

      const res = await POST(makeRequest({ amount: 500 }), makeParams("auction-1"));
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("Minimalna");
    });
  });

  // ── Bidding logika ───────────────────────────────────────────────

  describe("Bidding logika", () => {
    it("uspesno postavlja bid na aukciju bez prethodnih bidova", async () => {
      setupTransaction();
      const auction = makeAuction();
      const newBid = makeBid({ amount: { toString: () => "500", toNumber: () => 500 } });

      mockPrisma.auction.findUnique.mockResolvedValue(auction);
      mockPrisma.bid.findFirst.mockResolvedValue(null); // no existing bids
      mockPrisma.bid.create.mockResolvedValue(newBid);
      mockPrisma.bid.count.mockResolvedValue(1);
      // Outbid: no previous highest
      mockPrisma.bid.findMany.mockResolvedValue([]);
      mockPrisma.user.findMany.mockResolvedValue([]); // no admins

      const res = await POST(makeRequest({ amount: 500 }), makeParams("auction-1"));
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.bid.amount).toBe(500);
      expect(data.bid.id).toBe("bid-1");
    });

    it("SEALED: dozvoljava bid manji od postojeceg", async () => {
      setupTransaction();
      const auction = makeAuction({ auctionType: "SEALED" });
      const existingBid = makeBid({
        id: "bid-existing",
        userId: "buyer-2",
        amount: { toString: () => "1000", toNumber: () => 1000 },
      });
      const newBid = makeBid({ amount: { toString: () => "500", toNumber: () => 500 } });

      mockPrisma.auction.findUnique.mockResolvedValue(auction);
      mockPrisma.bid.findFirst.mockResolvedValueOnce(existingBid); // highest bid in tx
      mockPrisma.bid.create.mockResolvedValue(newBid);
      mockPrisma.bid.count.mockResolvedValue(2);
      mockPrisma.user.findMany.mockResolvedValue([]);

      const res = await POST(makeRequest({ amount: 500 }), makeParams("auction-1"));
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it("OPEN: bid mora biti > trenutno najvisi", async () => {
      setupTransaction();
      const auction = makeAuction({ auctionType: "OPEN" });
      const existingBid = makeBid({
        userId: "buyer-2",
        amount: { toString: () => "1000", toNumber: () => 1000 },
      });

      mockPrisma.auction.findUnique.mockResolvedValue(auction);
      mockPrisma.bid.findFirst.mockResolvedValue(existingBid);

      const res = await POST(makeRequest({ amount: 800 }), makeParams("auction-1"));
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("veca od trenutne");
    });

    it("vraca success sa bid ID, amount, timestamp", async () => {
      setupTransaction();
      const auction = makeAuction();
      const newBid = makeBid();

      mockPrisma.auction.findUnique.mockResolvedValue(auction);
      mockPrisma.bid.findFirst.mockResolvedValue(null);
      mockPrisma.bid.create.mockResolvedValue(newBid);
      mockPrisma.bid.count.mockResolvedValue(1);
      mockPrisma.bid.findMany.mockResolvedValue([]);
      mockPrisma.user.findMany.mockResolvedValue([]);

      const res = await POST(makeRequest({ amount: 500 }), makeParams("auction-1"));
      const data = await res.json();

      expect(data.success).toBe(true);
      expect(data.bid).toHaveProperty("id");
      expect(data.bid).toHaveProperty("amount");
      expect(data.bid).toHaveProperty("createdAt");
    });
  });

  // ── Pusher broadcast po tipu ─────────────────────────────────────

  describe("Pusher broadcast po tipu", () => {
    function setupSuccessfulBid(auctionType: string) {
      setupTransaction();
      const auction = makeAuction({ auctionType, showBidCount: true });
      const newBid = makeBid();

      mockPrisma.auction.findUnique.mockResolvedValue(auction);
      mockPrisma.bid.findFirst.mockResolvedValue(null);
      mockPrisma.bid.create.mockResolvedValue(newBid);
      mockPrisma.bid.count.mockResolvedValue(1);
      mockPrisma.bid.findMany.mockResolvedValue([]);
      mockPrisma.user.findMany.mockResolvedValue([]);
    }

    it("SEALED: samo private-user bid-placed, NEMA channel broadcast", async () => {
      setupSuccessfulBid("SEALED");

      await POST(makeRequest({ amount: 500 }), makeParams("auction-1"));

      // Should have private trigger for bid-placed
      const privateTrigger = mockPusher.trigger.mock.calls.find(
        (call: any[]) =>
          call[0] === "private-user-buyer-1" && call[1] === "bid-placed"
      );
      expect(privateTrigger).toBeDefined();

      // Should NOT have channel broadcast
      const channelTrigger = mockPusher.trigger.mock.calls.find(
        (call: any[]) => call[0] === "auction-auction-1" && call[1] === "new-bid"
      );
      expect(channelTrigger).toBeUndefined();
    });

    it("OPEN: auction channel new-bid SA bidder info + private bid-placed", async () => {
      setupSuccessfulBid("OPEN");

      await POST(makeRequest({ amount: 500 }), makeParams("auction-1"));

      // Channel broadcast with bidder info
      const channelTrigger = mockPusher.trigger.mock.calls.find(
        (call: any[]) => call[0] === "auction-auction-1" && call[1] === "new-bid"
      );
      expect(channelTrigger).toBeDefined();
      expect(channelTrigger![2]).toHaveProperty("bidderId");
      expect(channelTrigger![2]).toHaveProperty("bidderName");

      // Private bid-placed
      const privateTrigger = mockPusher.trigger.mock.calls.find(
        (call: any[]) =>
          call[0] === "private-user-buyer-1" && call[1] === "bid-placed"
      );
      expect(privateTrigger).toBeDefined();
    });

    it("INDICATOR: private bid-indicator svakom bidderu", async () => {
      setupTransaction();
      const auction = makeAuction({ auctionType: "INDICATOR", showBidCount: true });
      const newBid = makeBid();
      const highestAfter = makeBid({ userId: "buyer-1", amount: { toString: () => "500", toNumber: () => 500 } });

      mockPrisma.auction.findUnique.mockResolvedValue(auction);
      // In transaction: findFirst for highest bid
      mockPrisma.bid.findFirst
        .mockResolvedValueOnce(null) // no existing bid in tx
        .mockResolvedValueOnce(highestAfter); // highest after tx (for indicator)
      mockPrisma.bid.create.mockResolvedValue(newBid);
      mockPrisma.bid.count.mockResolvedValue(1);
      // findMany for distinct bidders (indicator)
      mockPrisma.bid.findMany
        .mockResolvedValueOnce([{ userId: "buyer-1" }, { userId: "buyer-2" }]) // bidders
        .mockResolvedValueOnce([]) // outbid: topBids
        .mockResolvedValueOnce([]); // losing bidders (not used here but just in case)
      mockPrisma.user.findMany.mockResolvedValue([]);

      await POST(makeRequest({ amount: 500 }), makeParams("auction-1"));

      // Should trigger bid-indicator for each bidder
      const indicatorCalls = mockPusher.trigger.mock.calls.filter(
        (call: any[]) => call[1] === "bid-indicator"
      );
      expect(indicatorCalls.length).toBeGreaterThanOrEqual(2);

      // buyer-1 should be isHighest=true
      const buyer1Indicator = indicatorCalls.find(
        (call: any[]) => call[0] === "private-user-buyer-1"
      );
      expect(buyer1Indicator![2].isHighest).toBe(true);

      // buyer-2 should be isHighest=false
      const buyer2Indicator = indicatorCalls.find(
        (call: any[]) => call[0] === "private-user-buyer-2"
      );
      expect(buyer2Indicator![2].isHighest).toBe(false);
    });

    it("ANONYMOUS: auction channel new-bid BEZ bidder ID + private indicator", async () => {
      setupSuccessfulBid("ANONYMOUS");

      await POST(makeRequest({ amount: 500 }), makeParams("auction-1"));

      // Channel broadcast WITHOUT bidderId
      const channelTrigger = mockPusher.trigger.mock.calls.find(
        (call: any[]) => call[0] === "auction-auction-1" && call[1] === "new-bid"
      );
      expect(channelTrigger).toBeDefined();
      expect(channelTrigger![2]).not.toHaveProperty("bidderId");

      // Private bid-indicator for bidder
      const indicatorTrigger = mockPusher.trigger.mock.calls.find(
        (call: any[]) =>
          call[0] === "private-user-buyer-1" && call[1] === "bid-indicator"
      );
      expect(indicatorTrigger).toBeDefined();
      expect(indicatorTrigger![2].isHighest).toBe(true);
    });
  });

  // ── Outbid notifikacije ──────────────────────────────────────────

  describe("Outbid notifikacije", () => {
    it("SEALED: NEMA outbid notifikacija", async () => {
      setupTransaction();
      const auction = makeAuction({ auctionType: "SEALED" });
      const newBid = makeBid();

      mockPrisma.auction.findUnique.mockResolvedValue(auction);
      mockPrisma.bid.findFirst.mockResolvedValue(null);
      mockPrisma.bid.create.mockResolvedValue(newBid);
      mockPrisma.bid.count.mockResolvedValue(1);
      mockPrisma.bid.findMany.mockResolvedValue([]);
      mockPrisma.user.findMany.mockResolvedValue([]);

      await POST(makeRequest({ amount: 500 }), makeParams("auction-1"));

      // No outbid notification should be created
      expect(mockPrisma.notification.create).not.toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ type: "OUTBID" }),
        })
      );
    });

    it("OPEN: notifikacija prethodnom highest bidderu", async () => {
      setupTransaction();
      const auction = makeAuction({ auctionType: "OPEN" });
      const newBid = makeBid({
        amount: { toString: () => "1500", toNumber: () => 1500 },
      });
      const previousBid = makeBid({
        id: "bid-old",
        userId: "buyer-2",
        amount: { toString: () => "1000", toNumber: () => 1000 },
        user: { id: "buyer-2", email: "buyer2@test.rs" },
      });

      mockPrisma.auction.findUnique.mockResolvedValue(auction);
      mockPrisma.bid.findFirst.mockResolvedValue(null); // no existing higher
      mockPrisma.bid.create.mockResolvedValue(newBid);
      mockPrisma.bid.count.mockResolvedValue(2);
      // topBids: [new highest, previous highest]
      mockPrisma.bid.findMany
        .mockResolvedValueOnce([
          { ...newBid, userId: "buyer-1" },
          { ...previousBid, userId: "buyer-2" },
        ])
        .mockResolvedValueOnce([]); // no additional calls
      mockPrisma.user.findMany.mockResolvedValue([]); // no admins

      await POST(makeRequest({ amount: 1500 }), makeParams("auction-1"));

      // Should create OUTBID notification for buyer-2
      expect(mockPrisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: "buyer-2",
            type: "OUTBID",
          }),
        })
      );
    });

    it("NEMA notifikacije ako isti korisnik ponovo licitira", async () => {
      setupTransaction();
      const auction = makeAuction({ auctionType: "OPEN" });
      const newBid = makeBid({
        amount: { toString: () => "1500", toNumber: () => 1500 },
      });

      mockPrisma.auction.findUnique.mockResolvedValue(auction);
      mockPrisma.bid.findFirst.mockResolvedValue(null);
      mockPrisma.bid.create.mockResolvedValue(newBid);
      mockPrisma.bid.count.mockResolvedValue(2);
      // topBids: both from buyer-1 (same user)
      mockPrisma.bid.findMany
        .mockResolvedValueOnce([
          { ...newBid, userId: "buyer-1" },
          {
            ...makeBid({ id: "bid-old", amount: { toString: () => "1000", toNumber: () => 1000 } }),
            userId: "buyer-1",
          },
        ])
        .mockResolvedValueOnce([]);
      mockPrisma.user.findMany.mockResolvedValue([]);

      await POST(makeRequest({ amount: 1500 }), makeParams("auction-1"));

      // Should NOT create OUTBID notification (same user)
      const outbidCalls = mockPrisma.notification.create.mock.calls.filter(
        (call: any[]) => call[0]?.data?.type === "OUTBID"
      );
      expect(outbidCalls.length).toBe(0);
    });
  });
});
