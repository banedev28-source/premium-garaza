"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { getPusherClient } from "@/lib/pusher-client";
import type { AuctionWithDetails, BidEvent, IndicatorEvent, AuctionStatusEvent } from "@/types";

export function useAuction(auctionId: string, userId?: string) {
  const [auction, setAuction] = useState<AuctionWithDetails | null>(null);
  const [highestBid, setHighestBid] = useState<number>(0);
  const [bidCount, setBidCount] = useState<number>(0);
  const [isHighest, setIsHighest] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const subscribedRef = useRef(false);

  const fetchAuction = useCallback(async () => {
    try {
      const res = await fetch(`/api/auctions/${auctionId}`);
      if (res.ok) {
        const data = await res.json();
        setAuction(data);
        setBidCount(data._count?.bids || 0);

        // Set highest bid from API response
        if (data.highestBidAmount != null) {
          setHighestBid(data.highestBidAmount);
        } else if (data.bids && data.bids.length > 0) {
          const max = Math.max(...data.bids.map((b: { amount: string | number }) => Number(b.amount)));
          setHighestBid(max);
        }

        // Set isHighest from API response
        if (data.userIsHighest != null) {
          setIsHighest(data.userIsHighest);
        }
      }
    } catch {
      // Error fetching auction
    } finally {
      setLoading(false);
    }
  }, [auctionId]);

  useEffect(() => {
    fetchAuction();
  }, [fetchAuction]);

  // Separate effect for Pusher subscriptions - does NOT depend on auction state
  useEffect(() => {
    if (subscribedRef.current) return;
    subscribedRef.current = true;

    const pusher = getPusherClient();

    // Subscribe to auction channel
    const channel = pusher.subscribe(`auction-${auctionId}`);

    channel.bind("new-bid", (data: BidEvent) => {
      setHighestBid(data.highestBid);
      setBidCount(data.bidCount);
      // If it's an open auction, check if this user is still highest
      if (data.bidderId && userId) {
        setIsHighest(data.bidderId === userId);
      }
      // Refetch to update bid list for all viewers (especially OPEN type)
      fetchAuction();
    });

    channel.bind("auction-ended", (data: AuctionStatusEvent) => {
      setAuction((prev) =>
        prev ? { ...prev, status: data.status, winnerId: data.winnerId || null, finalPrice: (data.finalPrice ?? null) as unknown as typeof prev.finalPrice } : null
      );
    });

    channel.bind("auction-started", () => {
      setAuction((prev) =>
        prev ? { ...prev, status: "LIVE" } : null
      );
    });

    // Subscribe to private user channel for indicators
    let userChannel: ReturnType<typeof pusher.subscribe> | null = null;
    if (userId) {
      userChannel = pusher.subscribe(`private-user-${userId}`);

      userChannel.bind("bid-indicator", (data: IndicatorEvent) => {
        if (data.auctionId === auctionId) {
          setIsHighest(data.isHighest);
          if (data.highestBid != null) {
            setHighestBid(data.highestBid);
          }
          if (data.bidCount != null) {
            setBidCount(data.bidCount);
          }
        }
      });

      userChannel.bind("bid-placed", () => {
        // Refetch to update own bids
        fetchAuction();
      });
    }

    return () => {
      subscribedRef.current = false;
      channel.unbind_all();
      pusher.unsubscribe(`auction-${auctionId}`);
      if (userId && userChannel) {
        userChannel.unbind_all();
        pusher.unsubscribe(`private-user-${userId}`);
      }
    };
  }, [auctionId, userId, fetchAuction]);

  return {
    auction,
    highestBid,
    bidCount,
    isHighest,
    loading,
    refetch: fetchAuction,
  };
}
