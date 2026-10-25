@AGENTS.md

# Claude Code – QuanLyDayThemFE

- Design skill: `impeccable` (v4.7.0) cài ở `.claude/skills/impeccable`, subagents ở `.claude/agents/`,
  hook detector trong `.claude/settings.json`. Gọi bằng `/impeccable <command> <target>`
  (ví dụ `/impeccable audit app/centers`, `/impeccable polish`).
- Ngữ cảnh sản phẩm: `PRODUCT.md`; hệ thống thị giác: `DESIGN.md`. Đọc cả hai trước khi sửa UI.
- Marketplace `impeccable` trỏ tới `D:\Project\FESkill\impeccable` đã được đăng ký; muốn dùng
  cho project khác: `/plugin install impeccable@impeccable`.
- Back-end: `D:\Project\QuanLyDayThem\backend` (.NET 10). Hợp đồng API: `docs/API-RESPONSE-CONTRACT.md`.
  FE chỉ hiện thực các luồng đã có endpoint; mọi kiểu dữ liệu nằm ở `lib/api/types.ts`.
