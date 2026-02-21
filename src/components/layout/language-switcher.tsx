"use client";

import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/providers/i18n-provider";

export function LanguageSwitcher() {
  const { locale, setLocale } = useI18n();

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => setLocale(locale === "sr" ? "en" : "sr")}
      className="text-xs font-medium"
    >
      {locale === "sr" ? "EN" : "SR"}
    </Button>
  );
}
