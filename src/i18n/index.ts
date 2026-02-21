import sr from "./sr.json";
import en from "./en.json";

const messages: Record<string, typeof sr> = { sr, en };

export function getMessages(locale: string) {
  return messages[locale] || messages.sr;
}

type NestedKeyOf<T> = T extends object
  ? {
      [K in keyof T & string]: T[K] extends object
        ? `${K}.${NestedKeyOf<T[K]>}`
        : K;
    }[keyof T & string]
  : never;

export type MessageKey = NestedKeyOf<typeof sr>;

export function t(messages: typeof sr, key: string, params?: Record<string, string | number>): string {
  const keys = key.split(".");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let value: any = messages;
  for (const k of keys) {
    value = value?.[k];
  }
  if (typeof value !== "string") return key;
  if (params) {
    return Object.entries(params).reduce(
      (str, [k, v]) => str.replace(`{${k}}`, String(v)),
      value
    );
  }
  return value;
}
