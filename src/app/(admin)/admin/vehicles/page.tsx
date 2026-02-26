"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ImageUpload } from "@/components/ui/image-upload";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/components/providers/i18n-provider";
import { toast } from "sonner";
import { GridSkeleton } from "@/components/ui/skeleton";

type Vehicle = {
  id: string;
  name: string;
  description?: string;
  specifications?: Record<string, string | number>;
  images: string[];
  auction?: { id: string; status: string } | null;
  createdBy: { name: string };
  createdAt: string;
};

export default function VehiclesPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [filter, setFilter] = useState<"available" | "active" | "sold">("available");
  const { t } = useI18n();

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [year, setYear] = useState("");
  const [mileage, setMileage] = useState("");
  const [fuel, setFuel] = useState("");
  const [transmission, setTransmission] = useState("");
  const [engine, setEngine] = useState("");
  const [power, setPower] = useState("");
  const [color, setColor] = useState("");
  const [images, setImages] = useState<string[]>([]);

  function resetForm() {
    setName("");
    setDescription("");
    setYear("");
    setMileage("");
    setFuel("");
    setTransmission("");
    setEngine("");
    setPower("");
    setColor("");
    setImages([]);
    setEditingVehicle(null);
  }

  function openEdit(v: Vehicle) {
    setEditingVehicle(v);
    setName(v.name);
    setDescription(v.description || "");
    setYear(v.specifications?.year?.toString() || "");
    setMileage(v.specifications?.mileage?.toString() || "");
    setFuel(v.specifications?.fuel?.toString() || "");
    setTransmission(v.specifications?.transmission?.toString() || "");
    setEngine(v.specifications?.engine?.toString() || "");
    setPower(v.specifications?.power?.toString() || "");
    setColor(v.specifications?.color?.toString() || "");
    setImages(v.images);
    setDialogOpen(true);
  }

  async function fetchVehicles() {
    const res = await fetch("/api/vehicles");
    if (res.ok) {
      setVehicles(await res.json());
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchVehicles();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const body = {
      name,
      description,
      specifications: {
        year: year ? parseInt(year) : undefined,
        mileage: mileage || undefined,
        fuel: fuel || undefined,
        transmission: transmission || undefined,
        engine: engine || undefined,
        power: power || undefined,
        color: color || undefined,
      },
      images,
    };

    const url = editingVehicle
      ? `/api/vehicles/${editingVehicle.id}`
      : "/api/vehicles";
    const method = editingVehicle ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      toast.success(t("common.success"));
      setDialogOpen(false);
      resetForm();
      fetchVehicles();
    } else {
      const data = await res.json();
      toast.error(data.error || t("common.error"));
    }
  }

  async function handleDelete(id: string) {
    if (!confirm(t("common.delete") + "?")) return;

    const res = await fetch(`/api/vehicles/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success(t("common.success"));
      fetchVehicles();
    } else {
      const data = await res.json();
      toast.error(data.error || t("common.error"));
    }
  }

  if (loading) {
    return <div className="space-y-6"><GridSkeleton count={6} /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl sm:text-2xl font-bold">{t("vehicle.title")}</h2>
        <Dialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}
        >
          <DialogTrigger asChild>
            <Button>{t("vehicle.create")}</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col" onPointerDownOutside={() => {
            if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
          }}>
            <DialogHeader>
              <DialogTitle>
                {editingVehicle ? t("common.edit") : t("vehicle.create")}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto flex-1 pr-1" onClick={(e) => {
              const tag = (e.target as HTMLElement).tagName;
              if (tag !== "INPUT" && tag !== "TEXTAREA" && tag !== "SELECT") {
                if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
              }
            }}>
              <div className="space-y-2">
                <Label>{t("vehicle.name")}</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>{t("vehicle.description")}</Label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} className="resize-y break-words whitespace-pre-wrap" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>{t("vehicle.year")}</Label>
                  <Input type="number" value={year} onChange={(e) => setYear(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>{t("vehicle.mileage")}</Label>
                  <Input value={mileage} onChange={(e) => setMileage(e.target.value)} placeholder="150.000 km" />
                </div>
                <div className="space-y-2">
                  <Label>{t("vehicle.fuel")}</Label>
                  <Input value={fuel} onChange={(e) => setFuel(e.target.value)} placeholder="Dizel" />
                </div>
                <div className="space-y-2">
                  <Label>{t("vehicle.transmission")}</Label>
                  <Input value={transmission} onChange={(e) => setTransmission(e.target.value)} placeholder="Automatik" />
                </div>
                <div className="space-y-2">
                  <Label>{t("vehicle.engine")}</Label>
                  <Input value={engine} onChange={(e) => setEngine(e.target.value)} placeholder="2.0 TDI" />
                </div>
                <div className="space-y-2">
                  <Label>{t("vehicle.power")}</Label>
                  <Input value={power} onChange={(e) => setPower(e.target.value)} placeholder="150 KS" />
                </div>
                <div className="space-y-2">
                  <Label>{t("vehicle.color")}</Label>
                  <Input value={color} onChange={(e) => setColor(e.target.value)} placeholder="Crna" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>{t("vehicle.images")}</Label>
                <ImageUpload images={images} onChange={setImages} />
              </div>
              <div className="flex gap-2 justify-end sticky bottom-0 bg-background pt-3 pb-1 border-t">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  {t("common.cancel")}
                </Button>
                <Button type="submit">{t("common.save")}</Button>
              </div>
              <div className="h-8 sm:h-0" />
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex gap-2">
        {(["available", "active", "sold"] as const).map((f) => (
          <Button
            key={f}
            size="sm"
            variant={filter === f ? "default" : "outline"}
            onClick={() => setFilter(f)}
          >
            {t(`vehicle.filter.${f}`)}
            <span className="ml-1.5 text-xs opacity-70">
              {vehicles.filter((v) => {
                if (f === "available") return !v.auction || v.auction.status === "DRAFT";
                if (f === "active") return v.auction?.status === "LIVE";
                return v.auction && ["ENDED", "CANCELLED", "ARCHIVED"].includes(v.auction.status);
              }).length}
            </span>
          </Button>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {vehicles.filter((v) => {
          if (filter === "available") return !v.auction || v.auction.status === "DRAFT";
          if (filter === "active") return v.auction?.status === "LIVE";
          return v.auction && ["ENDED", "CANCELLED", "ARCHIVED"].includes(v.auction.status);
        }).map((vehicle) => (
          <Card key={vehicle.id}>
            {vehicle.images[0] && (
              <div className="aspect-video overflow-hidden rounded-t-lg">
                <img
                  src={vehicle.images[0]}
                  alt={vehicle.name}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              </div>
            )}
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{vehicle.name}</CardTitle>
                {vehicle.auction && (
                  <Badge variant="secondary">
                    {vehicle.auction.status}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {vehicle.description && (
                <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                  {vehicle.description}
                </p>
              )}
              {vehicle.specifications && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {Object.entries(vehicle.specifications)
                    .filter(([, v]) => v)
                    .map(([key, value]) => (
                      <Badge key={key} variant="outline" className="text-xs">
                        {String(value)}
                      </Badge>
                    ))}
                </div>
              )}
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => openEdit(vehicle)}>
                  {t("common.edit")}
                </Button>
                {!vehicle.auction && (
                  <Button size="sm" variant="destructive" onClick={() => handleDelete(vehicle.id)}>
                    {t("common.delete")}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {vehicles.filter((v) => {
        if (filter === "available") return !v.auction || v.auction.status === "DRAFT";
        if (filter === "active") return v.auction?.status === "LIVE";
        return v.auction && ["ENDED", "CANCELLED", "ARCHIVED"].includes(v.auction.status);
      }).length === 0 && (
        <p className="text-center text-muted-foreground">{t("common.noResults")}</p>
      )}
    </div>
  );
}
