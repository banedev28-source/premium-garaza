"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/components/providers/i18n-provider";
import Link from "next/link";
import { GridSkeleton } from "@/components/ui/skeleton";

type WonAuction = {
  id: string;
  currency: string;
  finalPrice: string;
  endTime: string;
  vehicle: { name: string; images: string[] };
};

export default function WonAuctionsPage() {
  const [auctions, setAuctions] = useState<WonAuction[]>([]);
  const [loading, setLoading] = useState(true);
  const { t } = useI18n();

  useEffect(() => {
    fetch("/api/won-auctions")
      .then((res) => { if (!res.ok) throw new Error(); return res.json(); })
      .then(setAuctions)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="space-y-6"><h2 className="text-2xl font-bold">{t("nav.wonAuctions")}</h2><GridSkeleton count={3} /></div>;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">{t("nav.wonAuctions")}</h2>

      {auctions.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">
          {t("common.noResults")}
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {auctions.map((auction) => (
            <Link key={auction.id} href={`/auctions/${auction.id}`}>
              <Card className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer">
                {auction.vehicle.images[0] && (
                  <div className="aspect-video overflow-hidden">
                    <img
                      src={auction.vehicle.images[0]}
                      alt={auction.vehicle.name}
                      loading="lazy"
                      className="h-full w-full object-contain"
                    />
                  </div>
                )}
                <CardContent className="p-4">
                  <h4 className="font-semibold">{auction.vehicle.name}</h4>
                  <div className="flex items-center justify-between mt-2">
                    <Badge variant="default" className="bg-green-600">
                      {t("auction.winner")}
                    </Badge>
                    <p className="font-bold">
                      {Number(auction.finalPrice).toLocaleString()}{" "}
                      {auction.currency}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    {new Date(auction.endTime).toLocaleDateString()}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
