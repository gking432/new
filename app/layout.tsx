import type { Metadata } from "next";
import { DemoAutoReset } from "@/components/demo/DemoAutoReset";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Northstar Exterior & Home",
    template: "%s · Northstar Exterior & Home",
  },
  description:
    "Roofing, siding, windows, and exterior work handled with clarity from first call to final cleanup. Demonstration app — Home Service AI Command Center.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans">
        <DemoAutoReset />
        {children}
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
