import { describe, it, expect, vi } from "vitest";
import { mockSession, setMockSession, mockPrisma } from "./setup";

function makeRequest() {
  return {} as any;
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
    startingPrice: null,
    reservePrice: null,
    endTime: new Date(Date.now() + 3600000),
    startTime: new Date(Date.now() - 3600000),
    showBidCount: true,
    buyNowEnabled: false,
    winnerId: null,
    finalPrice: null,
    vehicle: { name: "BMW 320d" },
    createdBy: { id: "admin-1", name: "Admin", email: "admin@test.rs" },
    winner: null,
    _count: { bids: 2 },
    bids: [
      {
        id: "bid-1",
        userId: "buyer-1",
        amount: { toString: () => "1000", toNumber: () => 1000 },
        user: { id: "buyer-1", name: "Buyer 1" },
      },
      {
        id: "bid-2",
        userId: "buyer-2",
        amount: { toString: () => "800", toNumber: () => 800 },
        user: { id: "buyer-2", name: "Buyer 2" },
      },
    ],
    ...overrides,
  };
}

let GET: any;
beforeAll(async () => {
  const mod = await import("@/app/api/auctions/[id]/route");
  GET = mod.GET;
});

describe("GET /api/auctions/[id]", () => {
  it("SEALED + LIVE + BUYER: vidi samo sopstvene bidove, nema highestBid info", async () => {
    const auction = makeAuction({ auctionType: "SEALED" });
    mockPrisma.auction.findUnique.mockResolvedValue(auction);
    mockPrisma.bid.findFirst.mockResolvedValue({ id: "bid-1" }); // user has bid

    const res = await GET(makeRequest(), makeParams("auction-1"));
    const data = await res.json();

    // Only buyer-1's bids
    expect(data.bids.every((b: any) => b.userId === "buyer-1")).toBe(true);
    expect(data.highestBidAmount).toBeNull();
    expect(data.userIsHighest).toBeNull();
  });

  it("INDICATOR + BUYER: vidi samo sopstvene bidove, ima highestBid i userIsHighest", async () => {
    const auction = makeAuction({ auctionType: "INDICATOR" });
    mockPrisma.auction.findUnique.mockResolvedValue(auction);
    mockPrisma.bid.findFirst
      .mockResolvedValueOnce({ id: "bid-1" }) // userHasBid
      .mockResolvedValueOnce({
        amount: { toString: () => "1000", toNumber: () => 1000 },
        userId: "buyer-1",
      }); // highest bid

    const res = await GET(makeRequest(), makeParams("auction-1"));
    const data = await res.json();

    // Only buyer-1's bids
    expect(data.bids.every((b: any) => b.userId === "buyer-1")).toBe(true);
    expect(data.highestBidAmount).toBe(1000);
    expect(data.userIsHighest).toBe(true);
  });

  it("ANONYMOUS + BUYER: vidi sve bidove ali tudji userId='other', name='—'", async () => {
    const auction = makeAuction({ auctionType: "ANONYMOUS" });
    mockPrisma.auction.findUnique.mockResolvedValue(auction);
    mockPrisma.bid.findFirst
      .mockResolvedValueOnce({ id: "bid-1" }) // userHasBid
      .mockResolvedValueOnce({
        amount: { toString: () => "1000", toNumber: () => 1000 },
        userId: "buyer-1",
      }); // highest bid

    const res = await GET(makeRequest(), makeParams("auction-1"));
    const data = await res.json();

    // All bids visible
    expect(data.bids.length).toBe(2);
    // Own bid keeps identity
    const ownBid = data.bids.find((b: any) => b.userId === "buyer-1");
    expect(ownBid).toBeDefined();
    // Other bid has hidden identity
    const otherBid = data.bids.find((b: any) => b.userId === "other");
    expect(otherBid).toBeDefined();
    expect(otherBid.user.name).toBe("—");
  });

  it("OPEN + BUYER: vidi sve bidove sa identitetom", async () => {
    const auction = makeAuction({ auctionType: "OPEN" });
    mockPrisma.auction.findUnique.mockResolvedValue(auction);
    mockPrisma.bid.findFirst
      .mockResolvedValueOnce({ id: "bid-1" }) // userHasBid
      .mockResolvedValueOnce({
        amount: { toString: () => "1000", toNumber: () => 1000 },
        userId: "buyer-1",
      }); // highest bid

    const res = await GET(makeRequest(), makeParams("auction-1"));
    const data = await res.json();

    expect(data.bids.length).toBe(2);
    // Both bids have real identity
    expect(data.bids[0].user.name).toBe("Buyer 1");
    expect(data.bids[1].user.name).toBe("Buyer 2");
  });

  it("ENDED + BUYER koji nije ucestovao: prazan odgovor", async () => {
    const auction = makeAuction({
      status: "ENDED",
      winnerId: "buyer-2",
      finalPrice: { toString: () => "1000", toNumber: () => 1000 },
    });
    mockPrisma.auction.findUnique.mockResolvedValue(auction);
    mockPrisma.bid.findFirst.mockResolvedValue(null); // user has NOT bid

    const res = await GET(makeRequest(), makeParams("auction-1"));
    const data = await res.json();

    expect(data.bids).toEqual([]);
    expect(data.winner).toBeNull();
    expect(data.winnerId).toBeNull();
    expect(data.finalPrice).toBeNull();
    expect(data.userParticipated).toBe(false);
  });

  it("ADMIN: vidi sve bez restrikcija", async () => {
    mockSession.user.role = "ADMIN";
    mockSession.user.id = "admin-1";
    const auction = makeAuction({ auctionType: "SEALED" });
    mockPrisma.auction.findUnique.mockResolvedValue(auction);

    const res = await GET(makeRequest(), makeParams("auction-1"));
    const data = await res.json();

    // Admin sees all bids regardless of auction type
    expect(data.bids.length).toBe(2);
  });

  it("vraca 404 ako aukcija ne postoji", async () => {
    mockPrisma.auction.findUnique.mockResolvedValue(null);

    const res = await GET(makeRequest(), makeParams("nonexistent"));
    expect(res.status).toBe(404);
  });

  it("vraca 401 bez sesije", async () => {
    setMockSession(null);

    const res = await GET(makeRequest(), makeParams("auction-1"));
    expect(res.status).toBe(401);
  });
});
