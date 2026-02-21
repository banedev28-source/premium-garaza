"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/components/providers/i18n-provider";
import Link from "next/link";

type AuctionSummary = {
  id: string;
  status: string;
  vehicle: { name: string };
  _count: { bids: number };
  endTime: string;
  winner?: { name: string } | null;
};

export default function AdminDashboard() {
  const [auctions, setAuctions] = useState<AuctionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const { t } = useI18n();

  useEffect(() => {
    fetch("/api/auctions")
      .then((res) => res.json())
      .then(setAuctions)
      .finally(() => setLoading(false));
  }, []);

  const activeAuctions = auctions.filter((a) => a.status !== "ARCHIVED");

  const stats = {
    draft: auctions.filter((a) => a.status === "DRAFT").length,
    live: auctions.filter((a) => a.status === "LIVE").length,
    ended: auctions.filter((a) => a.status === "ENDED").length,
    cancelled: auctions.filter((a) => a.status === "CANCELLED").length,
  };

  const statusColor: Record<string, string> = {
    DRAFT: "secondary",
    LIVE: "default",
    ENDED: "outline",
    CANCELLED: "destructive",
  };

  if (loading) {
    return <div className="p-4">{t("common.loading")}</div>;
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">{t("nav.dashboard")}</h2>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
        {Object.entries(stats).map(([key, count]) => (
          <Card key={key}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t(`auction.status.${key.toUpperCase()}`)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{count}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("nav.auctions")}</CardTitle>
        </CardHeader>
        <CardContent>
          {activeAuctions.length === 0 ? (
            <p className="text-muted-foreground">{t("common.noResults")}</p>
          ) : (
            <div className="space-y-2">
              {activeAuctions.slice(0, 10).map((auction) => (
                <Link
                  key={auction.id}
                  href={`/admin/auctions/${auction.id}`}
                  className="flex items-center justify-between rounded-md border p-3 hover:bg-muted/50 transition-colors"
                >
                  <div>
                    <p className="font-medium">{auction.vehicle.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {auction._count.bids} {t("auction.bids").toLowerCase()}
                    </p>
                  </div>
                  <Badge variant={statusColor[auction.status] as "default" | "secondary" | "outline" | "destructive"}>
                    {t(`auction.status.${auction.status}`)}
                  </Badge>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
