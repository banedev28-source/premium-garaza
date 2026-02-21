import type {
  User,
  Vehicle,
  Auction,
  Bid,
  Notification,
  AuctionType,
  AuctionStatus,
  Currency,
  Role,
  UserStatus,
  NotificationType,
} from "@/generated/prisma/client";

export type { User, Vehicle, Auction, Bid, Notification };
export type { AuctionType, AuctionStatus, Currency, Role, UserStatus, NotificationType };

export type SafeUser = Omit<User, "passwordHash" | "inviteToken" | "inviteTokenExpiry">;

export type AuctionWithVehicle = Auction & {
  vehicle: Vehicle;
};

export type AuctionWithDetails = Auction & {
  vehicle: Vehicle;
  bids: (Bid & { user: Pick<User, "id" | "name"> })[];
  _count: { bids: number };
  createdBy: Pick<User, "id" | "name" | "email">;
};

export type BidWithUser = Bid & {
  user: Pick<User, "id" | "name">;
};

export type NotificationWithUser = Notification & {
  user: Pick<User, "id" | "name" | "email">;
};

// Pusher event types
export type BidEvent = {
  auctionId: string;
  highestBid: number;
  bidCount: number;
  bidderId?: string;
  bidderName?: string;
  timestamp: string;
};

export type IndicatorEvent = {
  auctionId: string;
  isHighest: boolean;
  highestBid?: number;
  bidCount?: number;
};

export type AuctionStatusEvent = {
  auctionId: string;
  status: AuctionStatus;
  winnerId?: string;
  finalPrice?: number;
};

export type NotificationEvent = {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, unknown>;
};
