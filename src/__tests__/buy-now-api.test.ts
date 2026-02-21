import { describe, it, expect, vi } from "vitest";
import { mockSession, setMockSession, mockPrisma, mockPusher } from "./setup";

function makeRequest() {
  return { json: () => Promise.resolve({}) } as any;
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

function makeAuction(overrides: Record<string, unknown> = {}) {
  return {
    id: "auction-1",
    status: "LIVE",
    auctionType: "OPEN",
    currency: "EUR",
    buyNowEnabled: true,
    buyNowPrice: { toString: () => "50000", toNumber: () => 50000 },
    startingPrice: null,
    reservePrice: null,
    endTime: new Date(Date.now() + 3600000),
    vehicle: { name: "BMW 320d" },
    ...overrides,
  };
}

let POST: any;
beforeAll(async () => {
  const mod = await import("@/app/api/auctions/[id]/buy-now/route");
  POST = mod.POST;
});

function setupTransaction() {
  mockPrisma.$transaction.mockImplementation(async (cb: any) => cb(mockPrisma));
}

describe("POST /api/auctions/[id]/buy-now", () => {
  describe("Auth", () => {
    it("vraca 401 ako nema sesije", async () => {
      setMockSession(null);
      const res = await POST(makeRequest(), makeParams("auction-1"));
      expect(res.status).toBe(401);
    });

    it("vraca 401 ako nije BUYER", async () => {
      mockSession.user.role = "ADMIN";
      const res = await POST(makeRequest(), makeParams("auction-1"));
      expect(res.status).toBe(401);
    });
  });

  describe("Validacija", () => {
    it("vraca 400 ako aukcija ne postoji", async () => {
      setupTransaction();
      mockPrisma.auction.findUnique.mockResolvedValue(null);

      const res = await POST(makeRequest(), makeParams("auction-1"));
      expect(res.status).toBe(400);
    });

    it("vraca 400 ako aukcija nije LIVE", async () => {
      setupTransaction();
      mockPrisma.auction.findUnique.mockResolvedValue(
        makeAuction({ status: "ENDED" })
      );

      const res = await POST(makeRequest(), makeParams("auction-1"));
      expect(res.status).toBe(400);
    });

    it("vraca 400 ako buyNow nije enabled", async () => {
      setupTransaction();
      mockPrisma.auction.findUnique.mockResolvedValue(
        makeAuction({ buyNowEnabled: false, buyNowPrice: null })
      );

      const res = await POST(makeRequest(), makeParams("auction-1"));
      expect(res.status).toBe(400);
    });
  });

  describe("Uspesna kupovina", () => {
    it("kreira bid sa isBuyNow=true, aukcija ENDED, winnerId i finalPrice", async () => {
      setupTransaction();
      const auction = makeAuction();
      const updatedAuction = {
        ...auction,
        status: "ENDED",
        winnerId: "buyer-1",
        finalPrice: auction.buyNowPrice,
      };

      mockPrisma.auction.findUnique.mockResolvedValue(auction);
      mockPrisma.bid.create.mockResolvedValue({
        id: "bid-buynow",
        auctionId: "auction-1",
        userId: "buyer-1",
        amount: auction.buyNowPrice,
        isBuyNow: true,
      });
      mockPrisma.auction.update.mockResolvedValue(updatedAuction);
      mockPrisma.bid.findMany.mockResolvedValue([]); // no other bidders
      mockPrisma.notification.create.mockResolvedValue({});

      const res = await POST(makeRequest(), makeParams("auction-1"));
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);

      // Bid created with isBuyNow
      expect(mockPrisma.bid.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ isBuyNow: true }),
        })
      );

      // Auction updated to ENDED with winnerId
      expect(mockPrisma.auction.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: "ENDED",
            winnerId: "buyer-1",
          }),
        })
      );
    });

    it("Pusher broadcast: auction-ended sa buyNow: true", async () => {
      setupTransaction();
      const auction = makeAuction();
      const updatedAuction = {
        ...auction,
        status: "ENDED",
        winnerId: "buyer-1",
        finalPrice: { toString: () => "50000", toNumber: () => 50000 },
      };

      mockPrisma.auction.findUnique.mockResolvedValue(auction);
      mockPrisma.bid.create.mockResolvedValue({ id: "bid-bn" });
      mockPrisma.auction.update.mockResolvedValue(updatedAuction);
      mockPrisma.bid.findMany.mockResolvedValue([]);
      mockPrisma.notification.create.mockResolvedValue({});

      await POST(makeRequest(), makeParams("auction-1"));

      const endedTrigger = mockPusher.trigger.mock.calls.find(
        (call: any[]) =>
          call[0] === "auction-auction-1" && call[1] === "auction-ended"
      );
      expect(endedTrigger).toBeDefined();
      expect(endedTrigger![2].buyNow).toBe(true);
    });

    it("notifikacije: BUY_NOW za kupca, AUCTION_END za ostale biddere", async () => {
      setupTransaction();
      const auction = makeAuction();
      const updatedAuction = {
        ...auction,
        status: "ENDED",
        winnerId: "buyer-1",
        finalPrice: auction.buyNowPrice,
      };

      mockPrisma.auction.findUnique.mockResolvedValue(auction);
      mockPrisma.bid.create.mockResolvedValue({ id: "bid-bn" });
      mockPrisma.auction.update.mockResolvedValue(updatedAuction);
      // Other bidders exist
      mockPrisma.bid.findMany.mockResolvedValue([{ userId: "buyer-2" }]);
      mockPrisma.notification.create.mockResolvedValue({});

      await POST(makeRequest(), makeParams("auction-1"));

      // BUY_NOW for buyer
      expect(mockPrisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: "buyer-1",
            type: "BUY_NOW",
          }),
        })
      );

      // AUCTION_END for other bidder
      expect(mockPrisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: "buyer-2",
            type: "AUCTION_END",
          }),
        })
      );
    });
  });
});
