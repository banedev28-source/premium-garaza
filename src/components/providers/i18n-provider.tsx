"use client";

import { createContext, useContext, useState, useCallback } from "react";
import sr from "@/i18n/sr.json";
import en from "@/i18n/en.json";
import { t } from "@/i18n";

type Messages = typeof sr;

const messages: Record<string, Messages> = { sr, en };

type I18nContextType = {
  locale: string;
  setLocale: (locale: string) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  messages: Messages;
};

const I18nContext = createContext<I18nContextType>({
  locale: "sr",
  setLocale: () => {},
  t: (key: string) => key,
  messages: sr,
});

export function I18nProvider({
  children,
  initialLocale = "sr",
}: {
  children: React.ReactNode;
  initialLocale?: string;
}) {
  const [locale, setLocale] = useState(initialLocale);
  const currentMessages = messages[locale] || messages.sr;

  const translate = useCallback(
    (key: string, params?: Record<string, string | number>) => {
      return t(currentMessages, key, params);
    },
    [currentMessages]
  );

  return (
    <I18nContext.Provider
      value={{
        locale,
        setLocale,
        t: translate,
        messages: currentMessages,
      }}
    >
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}
