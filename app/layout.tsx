import type { Metadata } from "next";
import { Fraunces, Outfit } from "next/font/google";
import "./globals.css";

const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["500", "600", "700"],
  style: ["normal", "italic"],
});

const body = Outfit({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Hamana Homes Thanksgiving & Year-End Party",
  description:
    "Hamana Homes invites every household to the Thanksgiving and year-end party at the Club House on December 19 at 6:00 PM.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${display.variable} ${body.variable}`}
        style={{ ["--snow" as string]: `url("${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/art/snow.jpg")` }}
      >
        {children}
      </body>
    </html>
  );
}
