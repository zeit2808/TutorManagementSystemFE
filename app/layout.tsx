import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Quản Lý Dạy Thêm", template: "%s · Quản Lý Dạy Thêm" },
  description: "Vận hành trung tâm dạy thêm: lớp học, lịch dạy, đăng ký và điểm danh theo đúng quyền của từng trung tâm.",
};

export const viewport: Viewport = {
  themeColor: "#19184f",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
