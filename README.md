# Quản Lý Dạy Thêm — Front-end

Next.js 16 (App Router) + React 19, giao diện vận hành cho back-end `D:\Project\QuanLyDayThem\backend` (.NET 10, API v1).

## Chạy local

```powershell
Copy-Item .env.example .env.local   # sửa BACKEND_ORIGIN nếu API không chạy ở http://localhost:5217
npm install
npm run dev                          # http://localhost:3000
```

- Mọi request đi qua `/api/v1/*` cùng origin; `next.config.ts` proxy tới `BACKEND_ORIGIN`, nhờ đó cookie refresh `tm.refresh` (HttpOnly, path `/api/v1/auth`) hoạt động mà không cần CORS.
- Đăng nhập Google cần `NEXT_PUBLIC_GOOGLE_CLIENT_ID` (trùng client ID cấu hình ở back-end).
- Kiểm tra: `npm run typecheck`, `npm run lint`, `npm run build`.

## Cấu trúc

```
app/                    route: /login, /select-center, /platform, /student, /centers/[centerId]/…
components/ui/          primitive dùng chung: Button, Field, Dialog, Notice, StateRail, Meter…
components/center/      màn hình vận hành trung tâm (layout CenterFrame cấp ngữ cảnh + quyền)
components/platform/    quản trị nền tảng
components/student/     cổng học sinh
components/auth/        đăng nhập, khôi phục, bảo mật
lib/api/                client hợp đồng API v1 (84/84 action) + bản dịch mã lỗi
lib/auth, lib/hooks     phiên, tải dữ liệu, tra cứu danh mục
```

Chi tiết luồng ↔ màn hình: [docs/API_COVERAGE.md](docs/API_COVERAGE.md). Hệ thống thiết kế: [DESIGN.md](DESIGN.md). Bối cảnh sản phẩm: [PRODUCT.md](PRODUCT.md).

## Claude Code

Skill thiết kế `impeccable` đã cài ở `.claude/skills/impeccable` (kèm subagent và hook). Dùng `/impeccable audit`, `/impeccable polish`… — xem `CLAUDE.md`.
