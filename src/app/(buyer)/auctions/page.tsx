"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/components/providers/i18n-provider";
import Link from "next/link";
import { GridSkeleton } from "@/components/ui/skeleton";

type AuctionListItem = {
  id: string;
  status: string;
  auctionType: string;
  currency: string;
  startTime: string;
  endTime: string;
  buyNowEnabled: boolean;
  buyNowPrice?: string | null;
  startingPrice?: string | null;
  showBidCount: boolean;
  vehicle: { name: string; images: string[]; description?: string };
  _count: { bids: number };
  winnerId?: string | null;
};

export default function AuctionsPage() {
  const { data: session } = useSession();
  const [auctions, setAuctions] = useState<AuctionListItem[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"live" | "ended">("live");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const { t } = useI18n();

  useEffect(() => {
    fetch("/api/auctions")
      .then((res) => { if (!res.ok) throw new Error(); return res.json(); })
      .then(setAuctions)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  const filtered = auctions
    .filter((a) => a.vehicle.name.toLowerCase().includes(search.toLowerCase()))
    .filter((a) => (filter === "live" ? a.status === "LIVE" : a.status === "ENDED"));

  function getTimeLeft(endTime: string) {
    const diff = new Date(endTime).getTime() - Date.now();
    if (diff <= 0) return t("auction.ended");
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days}d ${hours % 24}h`;
    }
    return `${hours}h ${minutes}m`;
  }

  if (loading) return <div className="space-y-6"><GridSkeleton count={6} /></div>;
  if (error) return <div className="p-8 text-center text-muted-foreground">{t("common.error")}</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl sm:text-2xl font-bold">{t("auction.title")}</h2>
        <Input
          placeholder={t("common.search")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
      </div>

      <div className="flex gap-2">
        <Button
          size="sm"
          variant={filter === "live" ? "default" : "outline"}
          onClick={() => setFilter("live")}
        >
          {t("auction.filter.active")}
          <span className="ml-1.5 text-xs opacity-70">
            {auctions.filter((a) => a.status === "LIVE").length}
          </span>
        </Button>
        <Button
          size="sm"
          variant={filter === "ended" ? "default" : "outline"}
          onClick={() => setFilter("ended")}
        >
          {t("auction.filter.ended")}
          <span className="ml-1.5 text-xs opacity-70">
            {auctions.filter((a) => a.status === "ENDED").length}
          </span>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map((auction) => (
          <Link key={auction.id} href={`/auctions/${auction.id}`}>
            <Card className={`overflow-hidden cursor-pointer transition-shadow hover:shadow-md ${
              auction.status === "ENDED" ? "opacity-75 hover:opacity-100" : ""
            }`}>
              {auction.vehicle.images[0] && (
                <div className="aspect-video overflow-hidden">
                  <img
                    src={auction.vehicle.images[0]}
                    alt={auction.vehicle.name}
                    loading="lazy"
                    className={`h-full w-full object-cover ${auction.status === "ENDED" ? "grayscale" : ""}`}
                  />
                </div>
              )}
              <CardContent className="p-4">
                <div className="mb-2">
                  <h4 className="font-semibold">{auction.vehicle.name}</h4>
                </div>
                {auction.status === "LIVE" && (
                  <>
                    {auction.vehicle.description && (
                      <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                        {auction.vehicle.description}
                      </p>
                    )}
                    <div className="flex items-center justify-between text-sm">
                      <div>
                        {auction.showBidCount && (
                          <span className="text-muted-foreground">
                            {auction._count.bids} {t("auction.bids").toLowerCase()}
                          </span>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">
                          {t("auction.timeLeft")}
                        </p>
                        <p className="font-medium">{getTimeLeft(auction.endTime)}</p>
                      </div>
                    </div>
                    {auction.buyNowEnabled && auction.buyNowPrice && (
                      <div className="mt-2 rounded bg-muted p-2 text-center text-sm">
                        {t("auction.buyNow")}: <strong>{auction.buyNowPrice} {auction.currency}</strong>
                      </div>
                    )}
                  </>
                )}
                {auction.status === "ENDED" && (
                  auction.winnerId === session?.user?.id ? (
                    <Badge className="mt-1 bg-green-600 hover:bg-green-700">
                      {t("auction.youWon")}
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="mt-1">
                      {t("auction.ended")}
                    </Badge>
                  )
                )}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="text-center text-muted-foreground py-8">
          {t("common.noResults")}
        </p>
      )}
    </div>
  );
}
