"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useI18n } from "@/components/providers/i18n-provider";

const adminLinks = [
  { href: "/admin/dashboard", labelKey: "nav.dashboard", icon: "M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" },
  { href: "/admin/auctions", labelKey: "nav.auctions", icon: "M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" },
  { href: "/admin/vehicles", labelKey: "nav.vehicles", icon: "M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-2-2.1-3.5C13.1 5 11.6 4 10 4H5.5C3.6 4 2 5.6 2 7.5V16c0 .6.4 1 1 1h2" },
  { href: "/admin/users", labelKey: "nav.users", icon: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M12 7a4 4 0 1 0-8 0 4 4 0 0 0 8 0M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const { t } = useI18n();

  return (
    <aside className="hidden w-56 shrink-0 border-r md:block">
      <nav className="flex flex-col gap-1 p-4">
        {adminLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
              pathname === link.href
                ? "bg-primary text-primary-foreground"
                : "hover:bg-muted"
            )}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d={link.icon} />
            </svg>
            {t(link.labelKey)}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
