import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

export default function ThemeToggle() {
  const [isDark, setIsDark] = useState(
    typeof window !== "undefined" &&
      (localStorage.getItem("theme") === "dark" ||
        (!localStorage.getItem("theme") &&
          window.matchMedia("(prefers-color-scheme: dark)").matches))
  );

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    localStorage.setItem("theme", isDark ? "dark" : "light");
    console.log("Theme toggled: ", isDark ? "dark" : "light");
  }, [isDark]);

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => setIsDark((prev) => !prev)}
        className="p-1 rounded bg-bg-card hover:bg-bg-border text-slate-400 hover:text-slate-200 transition-colors"
        aria-label="Toggle dark mode"
      >
        {isDark ? <Sun size={16} /> : <Moon size={16} />}
      </button>
      <span className="text-xs text-slate-500">{isDark ? "Dark" : "Light"}</span>
    </div>
  );
}
