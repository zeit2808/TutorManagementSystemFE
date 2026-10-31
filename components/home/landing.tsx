import Link from "next/link";
import { ArrowRight, BookOpen, Building2, CalendarCheck2, ClipboardCheck, GraduationCap, History, MailPlus, ShieldCheck, UserCog, UsersRound } from "lucide-react";
import { HeroScene } from "./hero-scene";
import { HeroStage } from "./hero-stage";
import { HeroActions, LandingNav } from "./landing-nav";
import { Reveal } from "./reveal";

const flow = [
  { icon: Building2, title: "Duyệt trung tâm", text: "Quản trị nền tảng tạo hồ sơ pháp lý, duyệt hoặc từ chối có lý do." },
  { icon: MailPlus, title: "Mời chủ trung tâm", text: "Lời mời qua email, hiệu lực 48 giờ, chỉ dùng một lần." },
  { icon: CalendarCheck2, title: "Xếp lịch không trùng", text: "Xem trước từng buổi; lớp, giáo viên và phòng không bao giờ bị xếp chồng." },
  { icon: ClipboardCheck, title: "Điểm danh có lịch sử", text: "Lưu nháp, nộp khi đủ học sinh; sửa sau đó phải ghi lý do." },
];

const roles = [
  { icon: ShieldCheck, role: "Quản trị nền tảng", does: "Duyệt, đình chỉ, khôi phục trung tâm; xét yêu cầu đổi hồ sơ pháp lý.", entry: "Tài khoản quản trị" },
  { icon: Building2, role: "Chủ & quản lý trung tâm", does: "Môn, phòng, lớp, giáo viên, học sinh, lịch dạy, duyệt đơn và điểm danh.", entry: "Tên đăng nhập từ lời mời" },
  { icon: UsersRound, role: "Giáo viên & nhân viên", does: "Xem lớp, lịch và danh sách học sinh của trung tâm mình thuộc về.", entry: "Tài khoản thành viên" },
  { icon: GraduationCap, role: "Học sinh", does: "Xem lớp đang tuyển, nộp đơn nhiều lớp một lần, theo dõi kết quả và lịch học.", entry: "Đăng nhập Google" },
];

const principles = [
  { icon: UserCog, title: "Không ai ghi đè ai", text: "Mỗi bản ghi mang số phiên bản. Hai người sửa cùng lúc, người lưu sau được báo để tải lại thay vì âm thầm mất dữ liệu." },
  { icon: CalendarCheck2, title: "Không có giờ học chồng nhau", text: "Trùng phòng, trùng giáo viên hay trùng lớp đều bị chặn trước khi lưu — kể cả khi tạo hàng chục buổi lặp theo tuần." },
  { icon: History, title: "Không xoá dấu vết", text: "Lưu trữ thay vì xoá, rút học thay vì gỡ tên, hiệu chỉnh điểm danh kèm lý do và trạng thái trước/sau." },
];

export function Landing() {
  return (
    <div className="landing">
      <LandingNav />

      <section className="hero" aria-labelledby="hero-title">
        <HeroScene />
        <div className="hero-glow" aria-hidden="true" />
        <div className="hero-copy">
          <h1 id="hero-title">
            Điều hành trung tâm dạy thêm,
            <span> từ lịch học đến từng lần điểm danh.</span>
          </h1>
          <p>Một hệ thống cho cả nền tảng, chủ trung tâm, giáo viên và học sinh — mỗi người đúng phần việc, đúng trung tâm, không trùng lịch, không mất dấu.</p>
          <HeroActions />
          <p className="hero-note">Học sinh? <Link href="/login">Đăng nhập bằng Google</Link> rồi mở đường dẫn đăng ký trung tâm gửi cho bạn.</p>
        </div>
        <div className="hero-stage-wrap">
          <HeroStage />
          <p className="hero-caption">Minh họa một ngày vận hành · dữ liệu mẫu</p>
        </div>
      </section>

      <section className="landing-section" id="quy-trinh" aria-labelledby="flow-title">
        <div className="landing-heading">
          <h2 id="flow-title">Một mạch từ hồ sơ trung tâm đến phiếu điểm danh</h2>
          <p>Mỗi bước chỉ mở khi bước trước hợp lệ, nên trạng thái luôn đi trước thao tác.</p>
        </div>
        <Reveal as="ol" className="flow">
          {flow.map(({ icon: Icon, title, text }, index) => (
            <li key={title} style={{ ["--i" as string]: index }}>
              <span className="flow-node"><Icon aria-hidden="true" /></span>
              <h3>{title}</h3>
              <p>{text}</p>
            </li>
          ))}
        </Reveal>
      </section>

      <section className="landing-section landing-alt" id="vai-tro" aria-labelledby="roles-title">
        <div className="landing-heading">
          <h2 id="roles-title">Mỗi người một khu vực, quyền theo từng trung tâm</h2>
          <p>Một tài khoản có thể là chủ ở trung tâm này và giáo viên ở trung tâm khác.</p>
        </div>
        <Reveal className="role-ledger">
          {roles.map(({ icon: Icon, role, does, entry }, index) => (
            <div className="role-row" key={role} style={{ ["--i" as string]: index }}>
              <span className="role-icon"><Icon aria-hidden="true" /></span>
              <strong>{role}</strong>
              <p>{does}</p>
              <span className="role-entry">{entry}</span>
            </div>
          ))}
        </Reveal>
      </section>

      <section className="landing-section" id="nguyen-tac" aria-labelledby="principles-title">
        <div className="principles">
          <div className="landing-heading">
            <h2 id="principles-title">Ba điều hệ thống không cho phép</h2>
            <p>Đó là những lỗi tốn kém nhất ở một trung tâm: ghi đè, xếp trùng và mất lịch sử.</p>
          </div>
          <Reveal className="principle-list">
            {principles.map(({ icon: Icon, title, text }, index) => (
              <article key={title} style={{ ["--i" as string]: index }}>
                <Icon aria-hidden="true" />
                <div>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </div>
              </article>
            ))}
          </Reveal>
        </div>
      </section>

      <section className="landing-cta" aria-labelledby="cta-title">
        <h2 id="cta-title">Sẵn sàng vào ca làm việc?</h2>
        <p>Trung tâm mới được mở qua quản trị nền tảng; chủ trung tâm nhận lời mời qua email.</p>
        <div className="hero-actions">
          <Link className="btn btn-primary btn-lg" href="/login">Đăng nhập <ArrowRight aria-hidden="true" /></Link>
          <Link className="btn btn-outline-light btn-lg" href="/accept-invitation">Nhận lời mời</Link>
        </div>
      </section>

      <footer className="landing-footer">
        <span className="brand"><span className="brand-mark"><BookOpen aria-hidden="true" /></span><strong>Quản Lý Dạy Thêm</strong></span>
        <nav aria-label="Liên kết cuối trang">
          <Link href="/login">Đăng nhập</Link>
          <Link href="/forgot-password">Quên mật khẩu</Link>
          <Link href="/accept-invitation">Nhận lời mời</Link>
        </nav>
      </footer>
    </div>
  );
}
