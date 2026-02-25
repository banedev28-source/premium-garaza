"use client";

import { use, useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { useAuction } from "@/hooks/useAuction";
import { useI18n } from "@/components/providers/i18n-provider";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

export default function AuctionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: session } = useSession();
  const { auction, highestBid, bidCount, isHighest, loading } = useAuction(
    id,
    session?.user?.id
  );
  const { t } = useI18n();
  const [bidAmount, setBidAmount] = useState("");
  const [bidding, setBidding] = useState(false);
  const [timeLeft, setTimeLeft] = useState("");
  const [currentImage, setCurrentImage] = useState(0);

  const updateTimeLeft = useCallback(() => {
    if (!auction) return;
    const diff = new Date(auction.endTime).getTime() - Date.now();
    if (diff <= 0) {
      setTimeLeft(t("auction.ended"));
      return;
    }
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    setTimeLeft(`${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`);
  }, [auction, t]);

  useEffect(() => {
    updateTimeLeft();
    const interval = setInterval(updateTimeLeft, 1000);
    return () => clearInterval(interval);
  }, [updateTimeLeft]);

  async function handleBid(e: React.FormEvent) {
    e.preventDefault();
    if (!bidAmount || bidding) return;

    setBidding(true);
    try {
      const res = await fetch(`/api/auctions/${id}/bid`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: parseFloat(bidAmount) }),
      });

      if (res.ok) {
        toast.success(t("auction.bidPlaced"));
        setBidAmount("");
      } else {
        const data = await res.json();
        toast.error(data.error || t("auction.bidError"));
      }
    } catch {
      toast.error(t("auction.bidError"));
    } finally {
      setBidding(false);
    }
  }

  async function handleBuyNow() {
    if (!auction?.buyNowPrice) return;

    const confirmed = confirm(
      t("auction.buyNowConfirm", {
        price: auction.buyNowPrice.toString(),
        currency: auction.currency,
      })
    );

    if (!confirmed) return;

    try {
      const res = await fetch(`/api/auctions/${id}/buy-now`, {
        method: "POST",
      });

      if (res.ok) {
        toast.success(t("auction.sold"));
      } else {
        const data = await res.json();
        toast.error(data.error);
      }
    } catch {
      toast.error(t("common.error"));
    }
  }

  if (loading) return <div className="grid gap-6 lg:grid-cols-2"><Skeleton className="aspect-video rounded-lg" /><div className="space-y-4"><Skeleton className="h-24 rounded-lg" /><Skeleton className="h-32 rounded-lg" /></div></div>;
  if (!auction) return <div className="p-4">Not found</div>;

  const isLive = auction.status === "LIVE";
  const isEnded = auction.status === "ENDED";
  const isBuyer = session?.user?.role === "BUYER";

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Image carousel */}
        <div className="space-y-2">
          {auction.vehicle.images.length > 0 ? (
            <>
              <div className="aspect-video overflow-hidden rounded-lg">
                <img
                  src={auction.vehicle.images[currentImage]}
                  alt={auction.vehicle.name}
                  className="h-full w-full object-cover"
                />
              </div>
              {auction.vehicle.images.length > 1 && (
                <div className="flex gap-2 overflow-x-auto">
                  {auction.vehicle.images.map((img, idx) => (
                    <button
                      key={idx}
                      onClick={() => setCurrentImage(idx)}
                      className={`h-16 w-24 shrink-0 overflow-hidden rounded border-2 ${
                        idx === currentImage
                          ? "border-primary"
                          : "border-transparent"
                      }`}
                    >
                      <img
                        src={img}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="aspect-video rounded-lg bg-muted flex items-center justify-center">
              <span className="text-muted-foreground">Nema slike</span>
            </div>
          )}

          {/* Vehicle details */}
          <Card>
            <CardHeader>
              <CardTitle>{auction.vehicle.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {auction.vehicle.description && (
                <p className="text-sm">{auction.vehicle.description}</p>
              )}
              {auction.vehicle.specifications && (
                <div className="flex flex-wrap gap-2">
                  {Object.entries(
                    auction.vehicle.specifications as Record<string, string | number>
                  )
                    .filter(([, v]) => v)
                    .map(([k, v]) => (
                      <Badge key={k} variant="outline">
                        {String(v)}
                      </Badge>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Bidding panel */}
        <div className="space-y-4">
          {/* Timer */}
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-sm text-muted-foreground">
                {isLive ? t("auction.timeLeft") : t("auction.status." + auction.status)}
              </p>
              <p className="text-3xl font-mono font-bold mt-1">
                {isLive ? timeLeft : t("auction.ended")}
              </p>
              <div className="flex justify-center gap-2 mt-2">
                <Badge variant="outline">{auction.currency}</Badge>
              </div>
            </CardContent>
          </Card>

          {/* Non-participant ended auction */}
          {isEnded && (auction as Record<string, unknown>).userParticipated === false && (
            <Card>
              <CardContent className="p-4 text-center text-muted-foreground">
                {t("auction.ended")}
              </CardContent>
            </Card>
          )}

          {/* Current bid info - depends on auction type */}
          {auction.auctionType !== "SEALED" && !((auction as Record<string, unknown>).userParticipated === false && isEnded) && (
            <Card>
              <CardContent className="p-4">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">
                    {t("auction.currentBid")}
                  </p>
                  <p className="text-3xl font-bold">
                    {highestBid > 0
                      ? `${highestBid.toLocaleString()} ${auction.currency}`
                      : auction.startingPrice
                        ? `${auction.startingPrice} ${auction.currency}`
                        : t("auction.noBids")}
                  </p>
                  {auction.showBidCount && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {bidCount} {t("auction.bids").toLowerCase()}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Indicator for INDICATOR type */}
          {auction.auctionType === "INDICATOR" && isHighest !== null && (
            <div
              className={`rounded-lg p-4 text-center font-medium ${
                isHighest
                  ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200"
                  : "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200"
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <span
                  className={`h-3 w-3 rounded-full ${
                    isHighest ? "bg-green-500" : "bg-red-500"
                  }`}
                />
                {isHighest
                  ? t("auction.youAreHighest")
                  : t("auction.youAreOutbid")}
              </div>
            </div>
          )}

          {/* OPEN type indicator */}
          {auction.auctionType === "OPEN" && isHighest !== null && (
            <div
              className={`rounded-lg p-3 text-center text-sm font-medium ${
                isHighest
                  ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200"
                  : "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200"
              }`}
            >
              {isHighest ? t("auction.youAreHighest") : t("auction.youAreOutbid")}
            </div>
          )}

          {/* Reserve price info */}
          {auction.showReservePrice && auction.reservePrice && (
            <p className="text-sm text-center text-muted-foreground">
              {t("auction.reservePrice")}: {auction.reservePrice.toString()} {auction.currency}
            </p>
          )}

          {/* Bid form */}
          {isLive && isBuyer && (
            <>
              <form onSubmit={handleBid} className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    type="number"
                    step="0.01"
                    value={bidAmount}
                    onChange={(e) => setBidAmount(e.target.value)}
                    placeholder={`${t("auction.yourBid")} (${auction.currency})`}
                    required
                    min={0.01}
                  />
                  <Button type="submit" disabled={bidding} className="shrink-0">
                    {bidding ? "..." : t("auction.placeBid")}
                  </Button>
                </div>
              </form>

              {auction.buyNowEnabled && auction.buyNowPrice && (
                <>
                  <Separator />
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={handleBuyNow}
                  >
                    {t("auction.buyNow")}: {auction.buyNowPrice.toString()}{" "}
                    {auction.currency}
                  </Button>
                </>
              )}
            </>
          )}

          {/* Winner display - only for participants */}
          {isEnded && auction.winnerId && (
            <Card>
              <CardContent className="p-4 text-center">
                {auction.winnerId === session?.user?.id ? (
                  <div className="space-y-1">
                    <p className="text-lg font-bold text-green-600">
                      {t("auction.youAreHighest")}
                    </p>
                    <p>
                      {t("auction.finalPrice")}: {auction.finalPrice?.toString()}{" "}
                      {auction.currency}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <p className="text-muted-foreground">{t("auction.ended")}</p>
                    {auction.finalPrice && (
                      <p>
                        {t("auction.finalPrice")}: {auction.finalPrice.toString()}{" "}
                        {auction.currency}
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {isEnded && !auction.winnerId && auction.reservePrice && (auction as Record<string, unknown>).userParticipated !== false && (
            <Card>
              <CardContent className="p-4 text-center text-muted-foreground">
                {t("auction.reserveNotMet")}
              </CardContent>
            </Card>
          )}

          {/* Bids history */}
          {auction.bids && auction.bids.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">{t("auction.bids")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {auction.bids.map((bid) => (
                    <div
                      key={bid.id}
                      className="flex items-center justify-between text-sm"
                    >
                      <div className="text-muted-foreground">
                        {bid.user && (
                          <span className={`font-medium ${bid.userId === session?.user?.id ? "text-primary" : "text-foreground"}`}>
                            {bid.userId === session?.user?.id ? t("auction.you") : bid.user.name}
                          </span>
                        )}
                        <span className="ml-2 text-xs">
                          {new Date(bid.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <span className="font-medium">
                        {Number(bid.amount).toLocaleString()} {auction.currency}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
