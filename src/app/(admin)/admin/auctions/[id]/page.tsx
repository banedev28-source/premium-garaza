"use client";

import { useEffect, useState, use } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useI18n } from "@/components/providers/i18n-provider";
import { toast } from "sonner";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";

type AuctionDetail = {
  id: string;
  status: string;
  auctionType: string;
  currency: string;
  startTime: string;
  endTime: string;
  startingPrice?: string | null;
  reservePrice?: string | null;
  showReservePrice: boolean;
  showBidCount: boolean;
  buyNowEnabled: boolean;
  buyNowPrice?: string | null;
  finalPrice?: string | null;
  vehicle: {
    id: string;
    name: string;
    description?: string;
    specifications?: Record<string, string | number>;
    images: string[];
  };
  createdBy: { id: string; name: string; email: string };
  winnerId?: string | null;
  winner?: { id: string; name: string } | null;
  bids: {
    id: string;
    amount: string;
    createdAt: string;
    isBuyNow: boolean;
    user: { id: string; name: string };
  }[];
  _count: { bids: number };
};

export default function AuctionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [auction, setAuction] = useState<AuctionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const { t } = useI18n();

  useEffect(() => {
    fetch(`/api/auctions/${id}`)
      .then((res) => res.json())
      .then(setAuction)
      .finally(() => setLoading(false));
  }, [id]);

  async function handleStatusChange(status: string) {
    const res = await fetch(`/api/auctions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });

    if (res.ok) {
      toast.success(t("common.success"));
      const data = await res.json();
      setAuction((prev) => (prev ? { ...prev, status: data.status } : null));
    } else {
      const data = await res.json();
      toast.error(data.error);
    }
  }

  if (loading) return <div className="space-y-6"><Skeleton className="h-8 w-48" /><div className="grid gap-6 md:grid-cols-2"><Skeleton className="h-64 rounded-lg" /><Skeleton className="h-64 rounded-lg" /></div></div>;
  if (!auction) return <div>Not found</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2 sm:gap-4">
        <Link href="/admin/auctions">
          <Button variant="ghost" size="sm">{t("common.back")}</Button>
        </Link>
        <h2 className="text-xl sm:text-2xl font-bold break-words min-w-0">{auction.vehicle.name}</h2>
        <Badge>{t(`auction.status.${auction.status}`)}</Badge>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Vehicle info */}
        <Card>
          <CardHeader>
            <CardTitle>{t("vehicle.title")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {auction.vehicle.images[0] && (
              <img
              src={auction.vehicle.images[0]}
              alt={auction.vehicle.name}
              loading="lazy"
              className="w-full rounded-lg object-contain aspect-video"
            />
            )}
            {auction.vehicle.description && (
              <p className="text-sm">{auction.vehicle.description}</p>
            )}
            {auction.vehicle.specifications && (
              <div className="flex flex-wrap gap-2">
                {Object.entries(auction.vehicle.specifications)
                  .filter(([, v]) => v)
                  .map(([k, v]) => (
                    <Badge key={k} variant="outline">
                      {t(`vehicle.${k}`)}: {String(v)}
                    </Badge>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Auction info */}
        <Card>
          <CardHeader>
            <CardTitle>Detalji aukcije</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
              <span className="text-muted-foreground">Tip:</span>
              <span>{t(`auction.type.${auction.auctionType}`)}</span>
              <span className="text-muted-foreground">{t("auction.currency")}:</span>
              <span>{auction.currency}</span>
              <span className="text-muted-foreground">{t("auction.startTime")}:</span>
              <span>{new Date(auction.startTime).toLocaleString()}</span>
              <span className="text-muted-foreground">{t("auction.endTime")}:</span>
              <span>{new Date(auction.endTime).toLocaleString()}</span>
              {auction.startingPrice && (
                <>
                  <span className="text-muted-foreground">{t("auction.startingPrice")}:</span>
                  <span>{auction.startingPrice} {auction.currency}</span>
                </>
              )}
              {auction.reservePrice && (
                <>
                  <span className="text-muted-foreground">{t("auction.reservePrice")}:</span>
                  <span>{auction.reservePrice} {auction.currency}</span>
                </>
              )}
              {auction.buyNowEnabled && (
                <>
                  <span className="text-muted-foreground">{t("auction.buyNowPrice")}:</span>
                  <span>{auction.buyNowPrice} {auction.currency}</span>
                </>
              )}
            </div>

            {auction.winner && (
              <>
                <Separator />
                <div className="rounded-md bg-green-50 p-3 text-green-800 dark:bg-green-950 dark:text-green-200">
                  <p className="font-medium">{t("auction.winner")}: {auction.winner.name}</p>
                  <p>{t("auction.finalPrice")}: {auction.finalPrice} {auction.currency}</p>
                </div>
              </>
            )}

            <Separator />

            <div className="flex flex-col sm:flex-row gap-2">
              {auction.status === "DRAFT" && (
                <Button onClick={() => handleStatusChange("LIVE")} className="sm:flex-1">
                  Pokreni aukciju
                </Button>
              )}
              {auction.status === "LIVE" && (
                <Button onClick={() => handleStatusChange("ENDED")} variant="destructive" className="sm:flex-1">
                  Zavrsi aukciju
                </Button>
              )}
              {(auction.status === "DRAFT" || auction.status === "LIVE") && (
                <Button onClick={() => handleStatusChange("CANCELLED")} variant="outline">
                  Otkazi
                </Button>
              )}
              {(auction.status === "ENDED" || auction.status === "CANCELLED") && (
                <Button onClick={() => handleStatusChange("ARCHIVED")} variant="outline" className="sm:flex-1">
                  {t("auction.archive")}
                </Button>
              )}
              {auction.status === "ARCHIVED" && (
                <Button onClick={() => handleStatusChange(auction.winnerId ? "ENDED" : "CANCELLED")} variant="outline" className="sm:flex-1">
                  {t("auction.restore")}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bids table */}
      <Card>
        <CardHeader>
          <CardTitle>
            {t("auction.bids")} ({auction._count.bids})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {auction.bids.length === 0 ? (
            <p className="text-muted-foreground">{t("auction.noBids")}</p>
          ) : (
            <div className="space-y-2">
              {auction.bids.map((bid, idx) => (
                <div
                  key={bid.id}
                  className={`flex items-center justify-between rounded-md border p-3 ${
                    idx === 0 ? "border-green-200 bg-green-50 dark:bg-green-950" : ""
                  }`}
                >
                  <div>
                    <p className="font-medium">{bid.user.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(bid.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">
                      {bid.amount} {auction.currency}
                    </p>
                    {bid.isBuyNow && (
                      <Badge variant="default" className="text-xs">
                        Buy Now
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
