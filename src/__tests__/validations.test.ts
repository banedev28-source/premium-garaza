import { describe, it, expect } from "vitest";
import {
  loginSchema,
  bidSchema,
  auctionSchema,
  vehicleSchema,
  inviteUserSchema,
} from "@/lib/validations";

describe("loginSchema", () => {
  it("prihvata validan input", () => {
    const result = loginSchema.safeParse({
      email: "test@example.com",
      password: "password123",
    });
    expect(result.success).toBe(true);
  });

  it("odbija prazan email", () => {
    const result = loginSchema.safeParse({ email: "", password: "password123" });
    expect(result.success).toBe(false);
  });

  it("odbija nevalidan email", () => {
    const result = loginSchema.safeParse({
      email: "not-an-email",
      password: "password123",
    });
    expect(result.success).toBe(false);
  });

  it("odbija kratku lozinku (< 6 karaktera)", () => {
    const result = loginSchema.safeParse({
      email: "test@example.com",
      password: "12345",
    });
    expect(result.success).toBe(false);
  });

  it("prihvata tacno 6 karaktera za lozinku", () => {
    const result = loginSchema.safeParse({
      email: "test@example.com",
      password: "123456",
    });
    expect(result.success).toBe(true);
  });
});

describe("bidSchema", () => {
  it("prihvata pozitivan amount", () => {
    const result = bidSchema.safeParse({ amount: 1000 });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.amount).toBe(1000);
  });

  it("odbija nulu", () => {
    const result = bidSchema.safeParse({ amount: 0 });
    expect(result.success).toBe(false);
  });

  it("odbija negativan amount", () => {
    const result = bidSchema.safeParse({ amount: -100 });
    expect(result.success).toBe(false);
  });

  it("odbija string umesto broja", () => {
    const result = bidSchema.safeParse({ amount: "abc" });
    expect(result.success).toBe(false);
  });
});

describe("auctionSchema", () => {
  // Use future dates to pass startTime > now() validation
  const futureStart = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const futureEnd = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

  const validAuction = {
    vehicleId: "vehicle-1",
    startTime: futureStart,
    endTime: futureEnd,
    currency: "EUR" as const,
    auctionType: "OPEN" as const,
  };

  it("prihvata validan input", () => {
    const result = auctionSchema.safeParse(validAuction);
    expect(result.success).toBe(true);
  });

  it("prihvata sve opcione parametre", () => {
    const result = auctionSchema.safeParse({
      ...validAuction,
      startingPrice: 5000,
      reservePrice: 10000,
      showReservePrice: true,
      showBidCount: false,
      buyNowEnabled: true,
      buyNowPrice: 20000,
    });
    expect(result.success).toBe(true);
  });

  it("odbija nedostajuci vehicleId", () => {
    const { vehicleId, ...rest } = validAuction;
    const result = auctionSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("odbija nedostajuci startTime", () => {
    const { startTime, ...rest } = validAuction;
    const result = auctionSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("odbija pogresan currency enum", () => {
    const result = auctionSchema.safeParse({
      ...validAuction,
      currency: "USD",
    });
    expect(result.success).toBe(false);
  });

  it("odbija pogresan auctionType enum", () => {
    const result = auctionSchema.safeParse({
      ...validAuction,
      auctionType: "INVALID",
    });
    expect(result.success).toBe(false);
  });

  it("prihvata sve validne auctionType enum vrednosti", () => {
    for (const type of ["SEALED", "OPEN", "INDICATOR", "ANONYMOUS"]) {
      const result = auctionSchema.safeParse({
        ...validAuction,
        auctionType: type,
      });
      expect(result.success).toBe(true);
    }
  });
});

describe("vehicleSchema", () => {
  it("prihvata validan input", () => {
    const result = vehicleSchema.safeParse({ name: "BMW 320d" });
    expect(result.success).toBe(true);
  });

  it("prihvata sa specifikacijama", () => {
    const result = vehicleSchema.safeParse({
      name: "BMW 320d",
      description: "Odlicno stanje",
      specifications: {
        year: 2020,
        mileage: "50000 km",
        fuel: "Dizel",
      },
    });
    expect(result.success).toBe(true);
  });

  it("odbija prazan naziv", () => {
    const result = vehicleSchema.safeParse({ name: "" });
    expect(result.success).toBe(false);
  });

  it("odbija bez naziva", () => {
    const result = vehicleSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe("inviteUserSchema", () => {
  it("prihvata validan input", () => {
    const result = inviteUserSchema.safeParse({
      email: "new@test.rs",
      role: "BUYER",
    });
    expect(result.success).toBe(true);
  });

  it("prihvata sa opcionim imenom", () => {
    const result = inviteUserSchema.safeParse({
      email: "new@test.rs",
      role: "ADMIN",
      name: "Novi Admin",
    });
    expect(result.success).toBe(true);
  });

  it("odbija nevalidan email", () => {
    const result = inviteUserSchema.safeParse({
      email: "not-email",
      role: "BUYER",
    });
    expect(result.success).toBe(false);
  });

  it("odbija pogresan role", () => {
    const result = inviteUserSchema.safeParse({
      email: "test@test.rs",
      role: "SUPERADMIN",
    });
    expect(result.success).toBe(false);
  });
});
