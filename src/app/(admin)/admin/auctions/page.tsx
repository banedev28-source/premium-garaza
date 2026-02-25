"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useI18n } from "@/components/providers/i18n-provider";
import { toast } from "sonner";
import Link from "next/link";
import { ListSkeleton } from "@/components/ui/skeleton";

type Vehicle = {
  id: string;
  name: string;
  auction?: { id: string } | null;
};

type AuctionListItem = {
  id: string;
  status: string;
  auctionType: string;
  currency: string;
  startTime: string;
  endTime: string;
  buyNowEnabled: boolean;
  buyNowPrice?: string | null;
  vehicle: { name: string; images: string[] };
  _count: { bids: number };
  winnerId?: string | null;
  winner?: { id: string; name: string } | null;
  finalPrice?: string | null;
};

export default function AdminAuctionsPage() {
  const [auctions, setAuctions] = useState<AuctionListItem[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [filter, setFilter] = useState<"active" | "ended" | "archived">("active");
  const { t } = useI18n();

  // Form state
  const [vehicleId, setVehicleId] = useState("");
  const [auctionType, setAuctionType] = useState("OPEN");
  const [currency, setCurrency] = useState("EUR");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [startingPrice, setStartingPrice] = useState("");
  const [reservePrice, setReservePrice] = useState("");
  const [showReservePrice, setShowReservePrice] = useState(false);
  const [showBidCount, setShowBidCount] = useState(true);
  const [buyNowEnabled, setBuyNowEnabled] = useState(false);
  const [buyNowPrice, setBuyNowPrice] = useState("");

  async function fetchData() {
    const [auctionsRes, vehiclesRes] = await Promise.all([
      fetch("/api/auctions"),
      fetch("/api/vehicles"),
    ]);
    if (auctionsRes.ok) setAuctions(await auctionsRes.json());
    if (vehiclesRes.ok) {
      const allVehicles = await vehiclesRes.json();
      setVehicles(allVehicles.filter((v: Vehicle) => !v.auction));
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchData();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const body = {
      vehicleId,
      auctionType,
      currency,
      startTime,
      endTime,
      startingPrice: startingPrice ? parseFloat(startingPrice) : undefined,
      reservePrice: reservePrice ? parseFloat(reservePrice) : undefined,
      showReservePrice,
      showBidCount,
      buyNowEnabled,
      buyNowPrice: buyNowPrice ? parseFloat(buyNowPrice) : undefined,
    };

    const res = await fetch("/api/auctions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      toast.success(t("common.success"));
      setDialogOpen(false);
      fetchData();
    } else {
      const data = await res.json();
      toast.error(data.error || t("common.error"));
    }
  }

  async function handleStatusChange(id: string, status: string) {
    const res = await fetch(`/api/auctions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });

    if (res.ok) {
      toast.success(t("common.success"));
      fetchData();
    } else {
      const data = await res.json();
      toast.error(data.error || t("common.error"));
    }
  }

  const statusColor: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
    DRAFT: "secondary",
    LIVE: "default",
    ENDED: "outline",
    CANCELLED: "destructive",
    ARCHIVED: "secondary",
  };

  const visibleAuctions = auctions.filter((a) => {
    if (filter === "active") return a.status === "DRAFT" || a.status === "LIVE";
    if (filter === "ended") return a.status === "ENDED" || a.status === "CANCELLED";
    return a.status === "ARCHIVED";
  });

  if (loading) return <div className="space-y-6"><ListSkeleton count={5} /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl sm:text-2xl font-bold">{t("auction.title")}</h2>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>{t("auction.create")}</Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{t("auction.create")}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <Label>{t("vehicle.name")}</Label>
                <Select value={vehicleId} onValueChange={setVehicleId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Izaberite vozilo" />
                  </SelectTrigger>
                  <SelectContent>
                    {vehicles.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Tip aukcije</Label>
                <Select value={auctionType} onValueChange={setAuctionType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["SEALED", "OPEN", "INDICATOR", "ANONYMOUS"].map((type) => (
                      <SelectItem key={type} value={type}>
                        {t(`auction.type.${type}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {t(`auction.typeDescription.${auctionType}`)}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>{t("auction.currency")}</Label>
                  <Select value={currency} onValueChange={setCurrency}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="EUR">EUR</SelectItem>
                      <SelectItem value="RSD">RSD</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t("auction.startingPrice")}</Label>
                  <Input
                    type="number"
                    value={startingPrice}
                    onChange={(e) => setStartingPrice(e.target.value)}
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>{t("auction.startTime")}</Label>
                  <Input
                    type="datetime-local"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("auction.endTime")}</Label>
                  <Input
                    type="datetime-local"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>{t("auction.reservePrice")}</Label>
                  <Input
                    type="number"
                    value={reservePrice}
                    onChange={(e) => setReservePrice(e.target.value)}
                    placeholder="Opciono"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>{t("auction.showReservePrice")}</Label>
                  <Switch checked={showReservePrice} onCheckedChange={setShowReservePrice} />
                </div>
                <div className="flex items-center justify-between">
                  <Label>{t("auction.showBidCount")}</Label>
                  <Switch checked={showBidCount} onCheckedChange={setShowBidCount} />
                </div>
                <div className="flex items-center justify-between">
                  <Label>{t("auction.buyNow")}</Label>
                  <Switch checked={buyNowEnabled} onCheckedChange={setBuyNowEnabled} />
                </div>
              </div>

              {buyNowEnabled && (
                <div className="space-y-2">
                  <Label>{t("auction.buyNowPrice")}</Label>
                  <Input
                    type="number"
                    value={buyNowPrice}
                    onChange={(e) => setBuyNowPrice(e.target.value)}
                    required={buyNowEnabled}
                  />
                </div>
              )}

              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  {t("common.cancel")}
                </Button>
                <Button type="submit">{t("common.create")}</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex gap-2">
        {(["active", "ended", "archived"] as const).map((f) => (
          <Button
            key={f}
            size="sm"
            variant={filter === f ? "default" : "outline"}
            onClick={() => setFilter(f)}
          >
            {t(`auction.filter.${f}`)}
            <span className="ml-1.5 text-xs opacity-70">
              {auctions.filter((a) => {
                if (f === "active") return a.status === "DRAFT" || a.status === "LIVE";
                if (f === "ended") return a.status === "ENDED" || a.status === "CANCELLED";
                return a.status === "ARCHIVED";
              }).length}
            </span>
          </Button>
        ))}
      </div>

      <div className="space-y-3">
        {visibleAuctions.map((auction) => (
          <Card key={auction.id}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start gap-3">
                {auction.vehicle.images?.[0] && (
                  <img
                    src={auction.vehicle.images[0] as string}
                    alt=""
                    loading="lazy"
                    className="h-16 w-24 shrink-0 rounded object-cover"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <Link href={`/admin/auctions/${auction.id}`} className="font-medium hover:underline break-words">
                    {auction.vehicle.name}
                  </Link>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    <Badge variant={statusColor[auction.status]}>
                      {t(`auction.status.${auction.status}`)}
                    </Badge>
                    <Badge variant="outline">
                      {t(`auction.type.${auction.auctionType}`)}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {auction._count.bids} {t("auction.bids").toLowerCase()}
                    </span>
                  </div>
                  {auction.winner && (
                    <p className="text-sm text-green-600 mt-1 break-words">
                      {t("auction.winner")}: {auction.winner.name} - {auction.finalPrice} {auction.currency}
                    </p>
                  )}
                </div>
              </div>
              {(auction.status === "DRAFT" || auction.status === "LIVE") && (
                <div className="flex gap-2 flex-wrap">
                  {auction.status === "DRAFT" && (
                    <Button size="sm" onClick={() => handleStatusChange(auction.id, "LIVE")}>
                      Start
                    </Button>
                  )}
                  {auction.status === "LIVE" && (
                    <Button size="sm" variant="destructive" onClick={() => handleStatusChange(auction.id, "ENDED")}>
                      End
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => handleStatusChange(auction.id, "CANCELLED")}>
                    {t("common.cancel")}
                  </Button>
                </div>
              )}
              {(auction.status === "ENDED" || auction.status === "CANCELLED") && (
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => handleStatusChange(auction.id, "ARCHIVED")}>
                    {t("auction.archive")}
                  </Button>
                </div>
              )}
              {auction.status === "ARCHIVED" && (
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => handleStatusChange(auction.id, auction.winnerId ? "ENDED" : "CANCELLED")}>
                    {t("auction.restore")}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}

        {visibleAuctions.length === 0 && (
          <p className="text-center text-muted-foreground py-8">
            {t("common.noResults")}
          </p>
        )}
      </div>
    </div>
  );
}
