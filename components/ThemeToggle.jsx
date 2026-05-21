"use client";

import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

export default function ThemeToggle() {
  // Initialize from stored theme or current class
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== "undefined") {
      return document.documentElement.classList.contains("dark");
    }
    return false;
  });

  // Apply stored preference on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("theme");
      if (stored) {
        const shouldBeDark = stored === "dark";
        const html = document.documentElement;
        if (shouldBeDark) {
          html.classList.add("dark");
        } else {
          html.classList.remove("dark");
        }
        setIsDark(shouldBeDark);
      }
    }
  }, []);

  const toggleTheme = () => {
    const html = document.documentElement;
    const nowDark = html.classList.toggle("dark");
    setIsDark(nowDark);
    localStorage.setItem("theme", nowDark ? "dark" : "light");
    console.log("Theme toggled:", nowDark ? "dark" : "light");
  };

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={toggleTheme}
        className="p-1 rounded bg-white dark:bg-bg-card hover:bg-bg-border text-slate-400 hover:text-slate-200 transition-colors"
        aria-label="Toggle dark mode"
      >
        {isDark ? <Sun size={16} /> : <Moon size={16} />}
      </button>
      <span className="text-xs text-slate-500">{isDark ? "Dark" : "Light"}</span>
    </div>
  );
}
