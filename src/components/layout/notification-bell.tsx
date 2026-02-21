"use client";

import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useNotifications } from "@/hooks/useNotifications";
import { useI18n } from "@/components/providers/i18n-provider";
import { formatDistanceToNow } from "date-fns";

export function NotificationBell() {
  const { data: session } = useSession();
  const { notifications, unreadCount, markAsRead, markAllRead } =
    useNotifications(session?.user?.id);
  const { t } = useI18n();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="relative">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
            <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
          </svg>
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] text-destructive-foreground">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between border-b p-3">
          <h4 className="text-sm font-semibold">{t("notification.title")}</h4>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs"
              onClick={markAllRead}
            >
              {t("notification.markAllRead")}
            </Button>
          )}
        </div>
        {notifications.length === 0 ? (
          <p className="p-4 text-center text-sm text-muted-foreground">
            {t("notification.noNotifications")}
          </p>
        ) : (
          <div className="max-h-80 overflow-y-auto divide-y">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className={`flex flex-col gap-1 p-3 cursor-pointer hover:bg-muted/50 ${
                  !notification.read ? "bg-muted/30" : ""
                }`}
                onClick={() => !notification.read && markAsRead(notification.id)}
              >
                <p className="text-sm font-medium">{notification.title}</p>
                <p className="text-xs text-muted-foreground">
                  {notification.message}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(notification.createdAt), {
                    addSuffix: true,
                  })}
                </p>
              </div>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
