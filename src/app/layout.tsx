import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Claims Query POC",
  description: "Natural language query prototype for medical insurance claims",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
