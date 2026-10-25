import Link from "next/link";
import { Compass } from "lucide-react";

export default function NotFound() {
  return (
    <main className="standalone-state">
      <Compass aria-hidden="true" />
      <h1>Không tìm thấy trang</h1>
      <p>Đường dẫn có thể đã thay đổi hoặc bạn không có quyền xem nội dung này.</p>
      <Link className="btn btn-primary" href="/select-center">Về trang chính</Link>
    </main>
  );
}
