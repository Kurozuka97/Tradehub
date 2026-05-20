import "./globals.css";

export const metadata = {
  title: "TradeHub",
  description: "Crypto · Forex · TA · Journal",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
