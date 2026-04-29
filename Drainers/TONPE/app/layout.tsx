import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Starbucks Coffee — Freshly Brewed Coffee, Espresso & More",
  description:
    "Welcome to Starbucks. Discover handcrafted coffee, espresso drinks, teas, and seasonal beverages. Find your nearest Starbucks store and order ahead.",
  keywords: [
    "starbucks",
    "coffee",
    "espresso",
    "latte",
    "cappuccino",
    "frappuccino",
    "coffee shop",
    "cafe",
  ],
  authors: [{ name: "Starbucks Coffee Company" }],
  openGraph: {
    title: "Starbucks Coffee",
    description: "Freshly brewed coffee, espresso, and handcrafted beverages.",
    type: "website",
    siteName: "Starbucks",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
