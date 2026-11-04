import type { Metadata } from "next";
export const metadata: Metadata = { title: "استوديو المطابخ", description: "تصميم وتفصيل وتسعير المطابخ." };
export default function RootLayout({children}: { children: React.ReactNode }) {
  return <html lang="ar" dir="rtl"><body>{children}</body></html>;
}
