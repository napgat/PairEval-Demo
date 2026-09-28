import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PairEval Demo",
  description: "ตัวอย่างระบบประเมินแบบเปรียบเทียบคู่สำหรับงานรายวิชา",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="th"><body>{children}</body></html>;
}
