import { describe, it, expect, vi } from "vitest";
import { mockPrisma, mockPusher } from "./setup";

function makeRequest(cronSecret?: string) {
  return {
    headers: {
      get: (name: string) => {
        if (name === "authorization") {
          return cronSecret ? `Bearer ${cronSecret}` : null;
        }
        return null;
      },
    },
  } as any;
}

let GET: any;
beforeAll(async () => {
  // Set CRON_SECRET env before importing
  process.env.CRON_SECRET = "test-cron-secret";
  const mod = await import("@/app/api/cron/auction-lifecycle/route");
  GET = mod.GET;
});

describe("GET /api/cron/auction-lifecycle", () => {
  describe("Auth", () => {
    it("vraca 401 bez CRON_SECRET", async () => {
      const res = await GET(makeRequest("wrong-secret"));
      expect(res.status).toBe(401);
    });

    it("vraca 401 bez authorization headera", async () => {
      const res = await GET(makeRequest());
      expect(res.status).toBe(401);
    });
  });

  describe("Startovanje aukcija", () => {
    it("startuje DRAFT aukcije ciji je startTime prosao → LIVE", async () => {
      const draftAuction = {
        id: "auction-draft",
        status: "DRAFT",
        startTime: new Date(Date.now() - 60000),
        vehicle: { name: "Audi A4" },
      };

      mockPrisma.auction.findMany
        .mockResolvedValueOnce([draftAuction]) // toStart
        .mockResolvedValueOnce([]); // toEnd
      mockPrisma.auction.update.mockResolvedValue({
        ...draftAuction,
        status: "LIVE",
      });

      const res = await GET(makeRequest("test-cron-secret"));
      const data = await res.json();

      expect(data.started).toBe(1);
      expect(mockPrisma.auction.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "auction-draft" },
          data: { status: "LIVE" },
        })
      );

      // Pusher broadcast
      expect(mockPusher.trigger).toHaveBeenCalledWith(
        "auction-auction-draft",
        "auction-started",
        expect.objectContaining({ status: "LIVE" })
      );
    });
  });

  describe("Zavrsavanje aukcija", () => {
    it("zavrsava LIVE aukcije ciji je endTime prosao → ENDED sa pobednikom", async () => {
      const liveAuction = {
        id: "auction-live",
        status: "LIVE",
        endTime: new Date(Date.now() - 60000),
        currency: "EUR",
        reservePrice: null,
        vehicle: { name: "BMW 320d" },
        bids: [
          {
            id: "bid-1",
            userId: "winner-1",
            amount: { toString: () => "5000", toNumber: () => 5000 },
            user: { id: "winner-1", name: "Winner", email: "w@t.rs" },
          },
        ],
      };

      mockPrisma.auction.findMany
        .mockResolvedValueOnce([]) // toStart
        .mockResolvedValueOnce([liveAuction]); // toEnd
      mockPrisma.auction.update.mockResolvedValue({
        ...liveAuction,
        status: "ENDED",
      });
      mockPrisma.notification.create.mockResolvedValue({});
      // Losing bidders
      mockPrisma.bid.findMany.mockResolvedValue([]);

      const res = await GET(makeRequest("test-cron-secret"));
      const data = await res.json();

      expect(data.ended).toBe(1);
      expect(mockPrisma.auction.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: "ENDED",
            winnerId: "winner-1",
          }),
        })
      );
    });

    it("odredjuje pobednika: highest bid >= reservePrice", async () => {
      const liveAuction = {
        id: "auction-reserve",
        status: "LIVE",
        endTime: new Date(Date.now() - 60000),
        currency: "EUR",
        reservePrice: { toString: () => "3000", toNumber: () => 3000 },
        vehicle: { name: "VW Golf" },
        bids: [
          {
            id: "bid-high",
            userId: "winner-1",
            amount: { toString: () => "5000", toNumber: () => 5000 },
            user: { id: "winner-1", name: "Winner", email: "w@t.rs" },
          },
        ],
      };

      mockPrisma.auction.findMany
        .mockResolvedValueOnce([]) // toStart
        .mockResolvedValueOnce([liveAuction]); // toEnd
      mockPrisma.auction.update.mockResolvedValue({
        ...liveAuction,
        status: "ENDED",
        winnerId: "winner-1",
      });
      mockPrisma.notification.create.mockResolvedValue({});
      mockPrisma.bid.findMany.mockResolvedValue([]);

      await GET(makeRequest("test-cron-secret"));

      expect(mockPrisma.auction.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ winnerId: "winner-1" }),
        })
      );
    });

    it("nema pobednika: highest bid < reservePrice → winnerId=null", async () => {
      const liveAuction = {
        id: "auction-noreserve",
        status: "LIVE",
        endTime: new Date(Date.now() - 60000),
        currency: "EUR",
        reservePrice: { toString: () => "10000", toNumber: () => 10000 },
        vehicle: { name: "Fiat Punto" },
        bids: [
          {
            id: "bid-low",
            userId: "bidder-1",
            amount: { toString: () => "5000", toNumber: () => 5000 },
            user: { id: "bidder-1", name: "Low Bidder", email: "l@t.rs" },
          },
        ],
      };

      mockPrisma.auction.findMany
        .mockResolvedValueOnce([]) // toStart
        .mockResolvedValueOnce([liveAuction]); // toEnd
      mockPrisma.auction.update.mockResolvedValue({
        ...liveAuction,
        status: "ENDED",
      });
      mockPrisma.notification.create.mockResolvedValue({});
      mockPrisma.bid.findMany.mockResolvedValue([{ userId: "bidder-1" }]);

      await GET(makeRequest("test-cron-secret"));

      expect(mockPrisma.auction.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: "ENDED",
            winnerId: null,
            finalPrice: null,
          }),
        })
      );
    });

    it("nema bidova → winnerId=null", async () => {
      const liveAuction = {
        id: "auction-nobids",
        status: "LIVE",
        endTime: new Date(Date.now() - 60000),
        currency: "EUR",
        reservePrice: null,
        vehicle: { name: "Opel Corsa" },
        bids: [],
      };

      mockPrisma.auction.findMany
        .mockResolvedValueOnce([]) // toStart
        .mockResolvedValueOnce([liveAuction]); // toEnd
      mockPrisma.auction.update.mockResolvedValue({
        ...liveAuction,
        status: "ENDED",
      });
      mockPrisma.bid.findMany.mockResolvedValue([]);

      await GET(makeRequest("test-cron-secret"));

      expect(mockPrisma.auction.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: "ENDED",
            winnerId: null,
            finalPrice: null,
          }),
        })
      );
    });

    it("notifikacije: AUCTION_WON za pobednika, AUCTION_LOST za gubitnike", async () => {
      const liveAuction = {
        id: "auction-notify",
        status: "LIVE",
        endTime: new Date(Date.now() - 60000),
        currency: "EUR",
        reservePrice: null,
        vehicle: { name: "Mercedes C200" },
        bids: [
          {
            id: "bid-winner",
            userId: "winner-1",
            amount: { toString: () => "8000", toNumber: () => 8000 },
            user: { id: "winner-1", name: "Winner", email: "w@t.rs" },
          },
        ],
      };

      mockPrisma.auction.findMany
        .mockResolvedValueOnce([]) // toStart
        .mockResolvedValueOnce([liveAuction]); // toEnd
      mockPrisma.auction.update.mockResolvedValue({
        ...liveAuction,
        status: "ENDED",
      });
      mockPrisma.notification.create.mockResolvedValue({});
      mockPrisma.notification.createMany.mockResolvedValue({ count: 1 });
      // Losing bidders
      mockPrisma.bid.findMany.mockResolvedValue([{ userId: "loser-1" }]);

      await GET(makeRequest("test-cron-secret"));

      // AUCTION_WON for winner (individual create)
      expect(mockPrisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: "winner-1",
            type: "AUCTION_WON",
          }),
        })
      );

      // AUCTION_LOST for losers (batch createMany)
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

      // Pusher notifications
      expect(mockPusher.trigger).toHaveBeenCalledWith(
        "private-user-winner-1",
        "notification",
        expect.objectContaining({ type: "AUCTION_WON" })
      );
      expect(mockPusher.trigger).toHaveBeenCalledWith(
        "private-user-loser-1",
        "notification",
        expect.objectContaining({ type: "AUCTION_LOST" })
      );
    });
  });
});
