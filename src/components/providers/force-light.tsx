"use client";

import { useTheme } from "next-themes";
import { useEffect } from "react";

export function ForceLight() {
  const { setTheme } = useTheme();

  useEffect(() => {
    setTheme("light");
  }, [setTheme]);

  return null;
}
