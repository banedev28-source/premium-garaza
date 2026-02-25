import { z } from "zod";
import { stripHtml } from "./sanitize";

export const loginSchema = z.object({
  email: z.string().email("Unesite validnu email adresu"),
  password: z.string().min(6, "Lozinka mora imati najmanje 6 karaktera"),
});

export const inviteUserSchema = z.object({
  email: z.string().email("Unesite validnu email adresu"),
  role: z.enum(["ADMIN", "BUYER"]),
  name: z.string().optional(),
});

const passwordPolicy = z
  .string()
  .min(8, "Lozinka mora imati najmanje 8 karaktera")
  .regex(/[A-Z]/, "Lozinka mora sadrzati najmanje jedno veliko slovo")
  .regex(/[a-z]/, "Lozinka mora sadrzati najmanje jedno malo slovo")
  .regex(/[0-9]/, "Lozinka mora sadrzati najmanje jedan broj");

export const setPasswordSchema = z.object({
  token: z.string(),
  password: passwordPolicy,
  name: z.string().min(1, "Unesite ime").transform(stripHtml),
});

export const vehicleSchema = z.object({
  name: z.string().min(1, "Unesite naziv vozila").transform(stripHtml),
  description: z.string().optional().transform((v) => (v ? stripHtml(v) : v)),
  specifications: z
    .object({
      year: z.number().optional(),
      mileage: z.string().optional(),
      fuel: z.string().optional(),
      transmission: z.string().optional(),
      engine: z.string().optional(),
      power: z.string().optional(),
      color: z.string().optional(),
    })
    .optional(),
  images: z.array(z.string()).default([]),
});

export const auctionSchema = z.object({
  vehicleId: z.string().min(1, "Izaberite vozilo"),
  startTime: z
    .string()
    .min(1, "Izaberite vreme pocetka")
    .refine((v) => !isNaN(Date.parse(v)), "Nevazeci format datuma za vreme pocetka"),
  endTime: z
    .string()
    .min(1, "Izaberite vreme zavrsetka")
    .refine((v) => !isNaN(Date.parse(v)), "Nevazeci format datuma za vreme zavrsetka"),
  currency: z.enum(["RSD", "EUR"]),
  startingPrice: z.number().positive("Pocetna cena mora biti pozitivna").optional(),
  reservePrice: z.number().positive("Rezervna cena mora biti pozitivna").optional(),
  showReservePrice: z.boolean().default(false),
  auctionType: z.enum(["SEALED", "OPEN", "INDICATOR", "ANONYMOUS"]),
  showBidCount: z.boolean().default(true),
  buyNowEnabled: z.boolean().default(false),
  buyNowPrice: z.number().positive("Buy Now cena mora biti pozitivna").optional(),
}).refine(
  (data) => new Date(data.endTime) > new Date(data.startTime),
  { message: "Vreme zavrsetka mora biti posle vremena pocetka", path: ["endTime"] }
).refine(
  (data) => new Date(data.startTime) > new Date(),
  { message: "Vreme pocetka mora biti u buducnosti", path: ["startTime"] }
).refine(
  (data) => !data.buyNowEnabled || !data.buyNowPrice || !data.startingPrice || data.buyNowPrice >= data.startingPrice,
  { message: "Buy Now cena mora biti veca ili jednaka pocetnoj ceni", path: ["buyNowPrice"] }
);

export const bidSchema = z.object({
  amount: z.number().positive("Ponuda mora biti pozitivna"),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type InviteUserInput = z.infer<typeof inviteUserSchema>;
export type SetPasswordInput = z.infer<typeof setPasswordSchema>;
export type VehicleInput = z.infer<typeof vehicleSchema>;
export type AuctionInput = z.infer<typeof auctionSchema>;
export type BidInput = z.infer<typeof bidSchema>;
