/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          base: "#0d0f14",
          surface: "#13161e",
          card: "#1a1e28",
          border: "#252836",
        },
        brand: {
          green: "#00d4aa",
          red: "#ff4d6a",
          blue: "#4d9fff",
          purple: "#9b87f5",
          amber: "#f5a623",
        },
      },
      fontFamily: {
        mono: ["'JetBrains Mono'", "monospace"],
        sans: ["'Inter'", "sans-serif"],
      },
    },
  },
  plugins: [],
};
