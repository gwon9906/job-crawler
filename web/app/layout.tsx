import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Job Crawler",
  description: "원티드/잡코리아/인디스워크에서 수집한 채용공고",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
