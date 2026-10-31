import Link from "next/link";
import { BookOpen, CalendarCheck2, ClipboardCheck, ShieldCheck } from "lucide-react";
import { BackButton } from "@/components/ui/primitives";
import type { ReactNode } from "react";

interface AuthShellProps {
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function AuthShell({ title, description, children, footer }: AuthShellProps) {
  return (
    <main className="auth">
      <section className="auth-story" aria-label="Giới thiệu hệ thống">
        <Link href="/" className="brand"><span className="brand-mark"><BookOpen aria-hidden="true" /></span><span><strong>Quản Lý Dạy Thêm</strong><small>Vận hành trung tâm</small></span></Link>
        <div className="auth-story-body">
          <h2>Mỗi buổi học có lớp, giáo viên, phòng và một phiếu điểm danh rõ ràng.</h2>
          <ul>
            <li><ShieldCheck aria-hidden="true" /><span><strong>Quyền theo từng trung tâm</strong>Một tài khoản có thể thuộc nhiều trung tâm với vai trò khác nhau.</span></li>
            <li><CalendarCheck2 aria-hidden="true" /><span><strong>Lịch không trùng</strong>Hệ thống chặn trùng lớp, giáo viên và phòng trước khi lưu.</span></li>
            <li><ClipboardCheck aria-hidden="true" /><span><strong>Điểm danh có lịch sử</strong>Nộp rồi chỉ sửa qua hiệu chỉnh có lý do.</span></li>
          </ul>
        </div>
        <p className="auth-story-foot">Tài khoản quản lý được tạo qua lời mời; học sinh đăng nhập bằng Google.</p>
      </section>
      <section className="auth-form-area">
        <BackButton href="/" className="auth-home">Trang chủ</BackButton>
        <div className="auth-card">
          <header>
            <h1>{title}</h1>
            <p>{description}</p>
          </header>
          {children}
        </div>
        {footer && <div className="auth-footer">{footer}</div>}
      </section>
    </main>
  );
}
