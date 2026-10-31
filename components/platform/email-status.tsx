"use client";

import { useState } from "react";
import { Mail, RefreshCcw, Send } from "lucide-react";
import { platformEmailApi, type OutboxEmail } from "@/lib/api";
import { useAction, useResource } from "@/lib/hooks/use-resource";
import { formatDateTime } from "@/lib/format";
import { outboxStatusLabels } from "@/lib/labels";
import { validateEmail } from "@/lib/validation";
import { Badge, Button, EmptyState, ErrorNotice, Field, Notice, PageHeader, Panel, SkeletonRows } from "@/components/ui/primitives";

/**
 * Is real email going out? The API only queues messages; the Worker sends them with the provider it is
 * configured for (File writes .txt files, Smtp sends). This page queues a test message and shows the outbox.
 */
export function PlatformEmailStatus() {
  const overview = useResource(() => platformEmailApi.overview(), []);
  const view = overview.data;
  const [to, setTo] = useState("");
  const [touched, setTouched] = useState(false);
  const [queued, setQueued] = useState<OutboxEmail | null>(null);
  const action = useAction();
  const toError = to.trim() ? validateEmail(to) : null;

  async function sendTest() {
    setTouched(true);
    if (toError) return;
    setQueued(null);
    const result = await action.run(() => platformEmailApi.sendTest(to.trim() || null));
    if (result) {
      setQueued(result);
      void overview.reload();
    }
  }

  return (
    <>
      <PageHeader title="Email hệ thống"
        description="API chỉ xếp email vào hàng đợi; Worker gửi đi. Worker chạy chế độ File thì email chỉ thành file trong .local\emails, chế độ Smtp thì gửi thật (cài bằng tools\setup-smtp.ps1)."
        actions={<Button icon={<RefreshCcw aria-hidden="true" />} onClick={() => void overview.reload()} pending={overview.loading}>Tải lại</Button>} />
      <ErrorNotice error={overview.error} onReload={() => void overview.reload()} />
      {view && (
        <dl className="money-strip" aria-label="Hàng đợi email">
          <div className={view.pending > 0 ? "is-warning" : undefined}><dt>Chờ gửi</dt><dd>{view.pending}</dd><span>Worker chưa chạy hoặc đang gửi</span></div>
          <div className={view.retrying > 0 ? "is-warning" : undefined}><dt>Lỗi, sẽ thử lại</dt><dd>{view.retrying}</dd><span>Thử lại sau 1, 5, 15 phút rồi mỗi giờ</span></div>
          <div className={view.failed > 0 ? "is-danger" : undefined}><dt>Gửi thất bại</dt><dd>{view.failed}</dd><span>Đã thử {view.maximumAttempts} lần hoặc bị từ chối</span></div>
          <div><dt>Đã gửi 24 giờ qua</dt><dd>{view.sentLast24Hours}</dd><span>Gồm cả ghi ra file</span></div>
        </dl>
      )}
      <Panel title="Gửi email thử" description="Bỏ trống để gửi tới email đăng nhập của bạn. Thư đi qua đúng hàng đợi và Worker như mọi email khác.">
        <div className="panel-body">
          {queued && (
            <Notice tone="success" onDismiss={() => setQueued(null)}>
              Đã xếp email thử tới {queued.recipient}. Bấm Tải lại sau vài giây: trạng thái phải thành “Đã gửi”, rồi kiểm tra hộp thư (cả mục Spam).
            </Notice>
          )}
          <ErrorNotice error={action.error} />
          <form className="email-test-form" noValidate onSubmit={(event) => { event.preventDefault(); void sendTest(); }}>
            <Field label="Gửi tới" error={touched ? toError : null} hint="Ví dụ: ten.ban@gmail.com">
              {(id, describedBy) => <input id={id} aria-describedby={describedBy} type="email" inputMode="email" autoComplete="email" value={to} onChange={(event) => setTo(event.target.value)} />}
            </Field>
            <Button type="submit" variant="primary" icon={<Send aria-hidden="true" />} pending={action.pending} status={action.status}>Gửi email thử</Button>
          </form>
        </div>
      </Panel>
      <Panel title="20 email gần nhất" description="Không hiển thị nội dung thư (có thể chứa mã bảo mật)." flush>
        {!view ? <SkeletonRows rows={4} columns={4} /> : view.recent.length === 0 ? (
          <EmptyState icon={<Mail aria-hidden="true" />} title="Chưa có email nào">Mời thành viên, quên mật khẩu, đổi lịch, nhắc học phí, duyệt đơn… sẽ tạo email ở đây.</EmptyState>
        ) : (
          <div className="table-wrap">
            <table className="table email-table">
              <thead><tr><th>Tạo lúc</th><th>Người nhận</th><th>Tiêu đề</th><th>Trạng thái</th><th className="num">Lần thử</th></tr></thead>
              <tbody>
                {view.recent.map((item) => {
                  const status = outboxStatusLabels[item.status] ?? { label: item.status, tone: "neutral" as const };
                  return (
                    <tr key={item.id}>
                      <td>{formatDateTime(item.createdAtUtc)}</td>
                      <td>{item.recipient}</td>
                      <td>{item.subject}</td>
                      <td>
                        <Badge tone={status.tone}>{status.label}</Badge>
                        {item.processedAtUtc && <p className="cell-note">{formatDateTime(item.processedAtUtc)}</p>}
                        {item.nextAttemptAtUtc && <p className="cell-note">Thử lại lúc {formatDateTime(item.nextAttemptAtUtc)}</p>}
                        {item.lastError && <p className="cell-note">{item.lastError}</p>}
                      </td>
                      <td className="num">{item.attempts}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}
