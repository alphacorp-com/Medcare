import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { MobileGate } from "@/components/shared/mobile-gate";
import "../globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "MedCare Admin",
  description: "Platform administration for MedCare",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <MobileGate
          title="Desktop or Tablet Required"
          description="The MedCare admin portal is optimized for larger screens and isn't available on phones. Please switch to a tablet, laptop, or desktop computer to continue."
        >
          {children}
        </MobileGate>
      </body>
    </html>
  );
}