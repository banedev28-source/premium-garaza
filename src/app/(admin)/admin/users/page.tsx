"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { ListSkeleton } from "@/components/ui/skeleton";

type UserItem = {
  id: string;
  email: string;
  name?: string | null;
  role: string;
  status: string;
  createdAt: string;
  invitedBy?: { name: string; email: string } | null;
  _count: { bids: number; wonAuctions: number };
};

export default function UsersPage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("BUYER");
  const { t } = useI18n();

  async function fetchUsers() {
    const res = await fetch("/api/users");
    if (res.ok) setUsers(await res.json());
    setLoading(false);
  }

  useEffect(() => {
    fetchUsers();
  }, []);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();

    const res = await fetch("/api/users/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, role }),
    });

    if (res.ok) {
      const data = await res.json();
      const inviteLink = data.inviteLink;
      toast.success("Pozivnica poslata!", {
        description: inviteLink,
        duration: 30000,
        action: {
          label: "Kopiraj",
          onClick: () => navigator.clipboard.writeText(inviteLink),
        },
      });
      setDialogOpen(false);
      setEmail("");
      fetchUsers();
    } else {
      const data = await res.json();
      toast.error(data.error);
    }
  }

  async function deleteUser(userId: string, email: string) {
    if (!confirm(`Da li ste sigurni da zelite da obrisete korisnika ${email}?`)) return;

    const res = await fetch(`/api/users/${userId}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Korisnik obrisan");
      fetchUsers();
    } else {
      const data = await res.json();
      toast.error(data.error);
    }
  }

  async function toggleStatus(userId: string, currentStatus: string) {
    const newStatus = currentStatus === "ACTIVE" ? "DEACTIVATED" : "ACTIVE";
    const res = await fetch(`/api/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });

    if (res.ok) {
      toast.success(t("common.success"));
      fetchUsers();
    }
  }

  const statusColor: Record<string, "default" | "secondary" | "destructive"> = {
    PENDING: "secondary",
    ACTIVE: "default",
    DEACTIVATED: "destructive",
  };

  if (loading) return <div className="space-y-6"><ListSkeleton count={5} /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl sm:text-2xl font-bold">{t("user.title")}</h2>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>{t("user.invite")}</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("user.invite")}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleInvite} className="space-y-4">
              <div className="space-y-2">
                <Label>{t("auth.email")}</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>{t("user.role")}</Label>
                <Select value={role} onValueChange={setRole}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BUYER">{t("user.roles.BUYER")}</SelectItem>
                    <SelectItem value="ADMIN">{t("user.roles.ADMIN")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  {t("common.cancel")}
                </Button>
                <Button type="submit">{t("common.submit")}</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="divide-y">
            {users.map((user) => (
              <div key={user.id} className="p-4 space-y-3">
                <div>
                  <p className="font-medium break-words">
                    {user.name || user.email}
                  </p>
                  {user.name && (
                    <p className="text-sm text-muted-foreground break-all">{user.email}</p>
                  )}
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    <Badge variant={statusColor[user.status]}>
                      {t(`user.statuses.${user.status}`)}
                    </Badge>
                    <Badge variant="outline">
                      {t(`user.roles.${user.role}`)}
                    </Badge>
                    {user._count.bids > 0 && (
                      <span className="text-xs text-muted-foreground">
                        {user._count.bids} ponuda
                      </span>
                    )}
                    {user._count.wonAuctions > 0 && (
                      <span className="text-xs text-green-600">
                        {user._count.wonAuctions} pobeda
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {user.status !== "PENDING" && (
                    <Button
                      size="sm"
                      variant={user.status === "ACTIVE" ? "destructive" : "default"}
                      onClick={() => toggleStatus(user.id, user.status)}
                    >
                      {user.status === "ACTIVE"
                        ? t("user.deactivate")
                        : t("user.activate")}
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => deleteUser(user.id, user.email)}
                  >
                    {t("common.delete")}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {users.length === 0 && (
        <p className="text-center text-muted-foreground">{t("common.noResults")}</p>
      )}
    </div>
  );
}
