import type { Metadata } from "next";
import { Courier_Prime, Inter, Outfit } from "next/font/google";
import { MeshBackground } from "@/components/layout/mesh-background";
import { TopBar } from "@/components/top-bar";
import "./globals.css";

const outfit = Outfit({ variable: "--font-outfit", subsets: ["latin"] });
const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const courierPrime = Courier_Prime({
  variable: "--font-courier-prime",
  subsets: ["latin"],
  weight: ["400", "700"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "Aaron's Writing Collection",
  description: "A private writing studio for anime screenplays.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${outfit.variable} ${inter.variable} ${courierPrime.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <MeshBackground />
        <TopBar />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
          {children}
        </main>
      </body>
    </html>
  );
}
