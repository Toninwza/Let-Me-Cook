import type { Metadata } from "next";
import { IBM_Plex_Sans_Thai, Unbounded } from "next/font/google";
import AuthProvider from "@/components/auth-provider";
import "./globals.css";

const plexThai = IBM_Plex_Sans_Thai({
  variable: "--font-plex-thai",
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
});

const unbounded = Unbounded({
  variable: "--font-unbounded",
  subsets: ["latin"],
  weight: ["600", "800"],
});

export const metadata: Metadata = {
  title: "PULL",
  description: "บอกครั้งเดียว bot ดึงของจากร้านบนแพลตฟอร์มมาให้ คัด 3 ตัว แล้วจ่ายจบในแชท",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="th" className={`${plexThai.variable} ${unbounded.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
