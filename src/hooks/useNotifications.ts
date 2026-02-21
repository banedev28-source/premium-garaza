"use client";

import { useState, useEffect, useCallback } from "react";
import { getPusherClient } from "@/lib/pusher-client";
import { toast } from "sonner";
import type { Notification, NotificationEvent } from "@/types";

export function useNotifications(userId?: string) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      if (res.ok) {
        const data = await res.json();
        setNotifications(data);
        setUnreadCount(data.filter((n: Notification) => !n.read).length);
      }
    } catch {
      // Error fetching notifications
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  useEffect(() => {
    if (!userId) return;

    const pusher = getPusherClient();
    const channel = pusher.subscribe(`private-user-${userId}`);

    channel.bind("notification", (data: NotificationEvent) => {
      // Show toast so user sees it immediately
      toast(data.title, { description: data.message });

      // Refetch from DB to avoid duplicates with temp IDs
      fetchNotifications();
    });

    return () => {
      channel.unbind_all();
      pusher.unsubscribe(`private-user-${userId}`);
    };
  }, [userId, fetchNotifications]);

  const markAsRead = async (id: string) => {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
  };

  const markAllRead = async () => {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAllRead: true }),
    });
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  };

  return {
    notifications,
    unreadCount,
    markAsRead,
    markAllRead,
    refetch: fetchNotifications,
  };
}
