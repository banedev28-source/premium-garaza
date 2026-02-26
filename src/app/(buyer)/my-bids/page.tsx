"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/components/providers/i18n-provider";
import Link from "next/link";
import { ListSkeleton } from "@/components/ui/skeleton";

type BidItem = {
  id: string;
  amount: string;
  createdAt: string;
  auction: {
    id: string;
    status: string;
    currency: string;
    auctionType: string;
    vehicle: { name: string; images: string[] };
  };
};

export default function MyBidsPage() {
  const [bids, setBids] = useState<BidItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { t } = useI18n();

  useEffect(() => {
    fetch("/api/my-bids")
      .then((res) => { if (!res.ok) throw new Error(); return res.json(); })
      .then(setBids)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="space-y-6"><h2 className="text-2xl font-bold">{t("nav.myBids")}</h2><ListSkeleton count={4} /></div>;

  // Group bids by auction
  const auctionMap = new Map<string, BidItem[]>();
  for (const bid of bids) {
    const existing = auctionMap.get(bid.auction.id) || [];
    existing.push(bid);
    auctionMap.set(bid.auction.id, existing);
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">{t("nav.myBids")}</h2>

      {auctionMap.size === 0 ? (
        <p className="text-center text-muted-foreground py-8">
          {t("common.noResults")}
        </p>
      ) : (
        <div className="space-y-4">
          {Array.from(auctionMap.entries()).map(([auctionId, auctionBids]) => {
            const auction = auctionBids[0].auction;
            const highestBid = Math.max(
              ...auctionBids.map((b) => Number(b.amount))
            );

            return (
              <Link key={auctionId} href={`/auctions/${auctionId}`}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer">
                  <CardContent className="flex items-center gap-4 p-4">
                    {auction.vehicle.images[0] && (
                      <img
                        src={auction.vehicle.images[0]}
                        alt=""
                        loading="lazy"
                        className="h-16 w-24 rounded object-contain"
                      />
                    )}
                    <div className="flex-1">
                      <p className="font-medium">{auction.vehicle.name}</p>
                      <div className="flex gap-2 mt-1">
                        <Badge
                          variant={
                            auction.status === "LIVE" ? "default" : "secondary"
                          }
                        >
                          {t(`auction.status.${auction.status}`)}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {auctionBids.length} ponuda
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">
                        Vasa najveca ponuda
                      </p>
                      <p className="text-lg font-bold">
                        {highestBid.toLocaleString()} {auction.currency}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
