import type { Metadata } from "next";
import { Chakra_Petch } from "next/font/google";
import "./globals.css";

const chakraPetch = Chakra_Petch({
  weight: ["300", "400", "500", "600", "700"],
  subsets: ["latin", "thai"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "PairEval · ประเมินผลงาน",
  description: "จัดการงานประเมิน เปรียบเทียบผลงาน และติดตามคะแนนรายวิชา",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="th"><body className={chakraPetch.className}>{children}</body></html>;
}
