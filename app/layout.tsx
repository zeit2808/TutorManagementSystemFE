import type { Metadata, Viewport } from "next";
import { ThemeWatcher } from "@/lib/theme";
import { THEME_BOOT_SCRIPT } from "@/lib/theme-script";
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
    <html lang="vi" data-theme="light" suppressHydrationWarning>
      <head>
        {/* Applies the saved light/dark choice before the first paint. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body suppressHydrationWarning>
        <ThemeWatcher />
        {children}
      </body>
    </html>
  );
}
