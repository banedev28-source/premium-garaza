"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useI18n } from "@/components/providers/i18n-provider";

const buyerLinks = [
  {
    href: "/auctions",
    labelKey: "nav.auctions",
    icon: "M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5",
  },
  {
    href: "/my-bids",
    labelKey: "nav.myBids",
    icon: "M9 12l2 2 4-4M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z",
  },
  {
    href: "/won",
    labelKey: "nav.wonAuctions",
    icon: "M6 9H4.5a2.5 2.5 0 0 1 0-5C7 4 7 7 7 7M18 9h1.5a2.5 2.5 0 0 0 0-5C17 4 17 7 17 7M12 18v-3M8 18h8M12 9v0M8 6h8l1 3H7l1-3z",
  },
];

export function BuyerNav() {
  const pathname = usePathname();
  const { t } = useI18n();

  return (
    <>
      {/* Desktop: top tab nav */}
      <nav className="hidden border-b md:block">
        <div className="container flex gap-4 px-4">
          {buyerLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "border-b-2 py-3 text-sm font-medium transition-colors",
                pathname === link.href ||
                  (link.href !== "/auctions" && pathname.startsWith(link.href))
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {t(link.labelKey)}
            </Link>
          ))}
        </div>
      </nav>

      {/* Mobile: fixed bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background md:hidden">
        <div className="flex justify-around">
          {buyerLinks.map((link) => {
            const isActive =
              pathname === link.href ||
              (link.href !== "/auctions" && pathname.startsWith(link.href));
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "flex flex-1 flex-col items-center gap-1 py-2 text-xs transition-colors",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground"
                )}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
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
            );
          })}
        </div>
      </nav>
    </>
  );
}
