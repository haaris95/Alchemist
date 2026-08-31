import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AIchemist — Your AI teammate in the room",
  description: "A collaborative brainstorming workspace where AIchemist works directly on the board alongside humans.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
