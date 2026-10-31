"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarDays, QrCode, WalletCards } from "lucide-react";
import { financeApi, type StudentTuition } from "@/lib/api";
import { useResource } from "@/lib/hooks/use-resource";
import { formatIsoDate, formatMoney, formatPeriod } from "@/lib/format";
import { missedKindLabels, paymentMethodLabels } from "@/lib/labels";
import { ChargeBadge } from "@/components/center/tuition";
import { PaymentQr } from "@/components/center/payment-qr";
import { EmptyState, ErrorNotice, Notice, PageHeader, Panel, SkeletonRows, Button } from "@/components/ui/primitives";

/** H14: what to pay in every center, how to transfer, and what was paid (read only). */
export function MyTuitionPage() {
  const tuition = useResource(() => financeApi.myTuition(), []);
  const data = tuition.data;
  return (
    <>
      <PageHeader
        title="Học phí"
        description="Học phí theo tháng ở từng trung tâm. Vắng học vẫn tính tiền; nếu trung tâm giảm cho buổi nghỉ, số tiền sẽ tự cập nhật ở đây."
        actions={<Link className="btn btn-secondary" href="/student"><CalendarDays aria-hidden="true" />Lịch học</Link>}
      />
      <ErrorNotice error={tuition.error} onReload={() => void tuition.reload()} />
      {!data ? <Panel><SkeletonRows rows={4} columns={4} /></Panel> : data.centers.length === 0 ? (
        <Panel><EmptyState icon={<WalletCards aria-hidden="true" />} title="Chưa có học phí">Khi lớp bạn học đặt học phí, các khoản cần đóng sẽ hiện ở đây.</EmptyState></Panel>
      ) : data.centers.map((center) => <CenterTuition key={center.centerId} center={center} />)}
    </>
  );
}

/** One-line reminder on the schedule page when something is owed. */
export function TuitionReminderNotice() {
  const tuition = useResource(() => financeApi.myTuition(), []);
  const owed = tuition.data?.centers.reduce((sum, x) => sum + x.owed, 0) ?? 0;
  const overdue = tuition.data?.centers.reduce((sum, x) => sum + x.overdue, 0) ?? 0;
  if (owed <= 0) return null;
  return (
    <Notice tone={overdue > 0 ? "warning" : "info"} title={overdue > 0 ? `Học phí quá hạn: ${formatMoney(overdue)}` : `Học phí cần đóng: ${formatMoney(owed)}`}
      action={<Link className="btn btn-secondary btn-sm" href="/student/tuition">Xem và chuyển khoản</Link>}>
      Mở trang Học phí để xem từng kỳ và mã QR chuyển khoản.
    </Notice>
  );
}

function CenterTuition({ center }: { center: StudentTuition }) {
  const [showQr, setShowQr] = useState(center.owed > 0);
  return (
    <Panel title={center.centerName} description={center.studentName}>
      <dl className="money-strip money-strip-3">
        <div className={center.owed > 0 ? "is-warning" : undefined}><dt>Còn phải đóng</dt><dd>{formatMoney(center.owed)}</dd></div>
        <div className={center.overdue > 0 ? "is-danger" : undefined}><dt>Quá hạn</dt><dd>{formatMoney(center.overdue)}</dd></div>
        <div><dt>Số dư</dt><dd>{formatMoney(center.credit)}</dd></div>
      </dl>
      {center.owed > 0 && center.bank && (
        <div className="qr-row">
          <Button size="sm" variant="soft" icon={<QrCode aria-hidden="true" />} aria-expanded={showQr} onClick={() => setShowQr((x) => !x)}>{showQr ? "Ẩn mã QR" : "Hiện mã QR chuyển khoản"}</Button>
          {showQr && (
            <PaymentQr load={() => financeApi.createMyPaymentIntent(center.studentId)} deps={[center.studentId, center.owed]}
              note="Sau khi trung tâm ghi nhận, khoản sẽ chuyển sang “Đã đóng”." />
          )}
        </div>
      )}
      {center.charges.length > 0 && (
        <div className="table-wrap">
          <table className="table tuition-table">
            <thead><tr><th>Lớp · kỳ</th><th className="num">Phải đóng</th><th className="num">Đã đóng</th><th>Hạn</th><th>Trạng thái</th></tr></thead>
            <tbody>
              {center.charges.map((item) => {
                return (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.className}</strong><p className="cell-note">Kỳ {item.cycleNumber} · {formatPeriod(item.periodStart, item.periodEnd)}</p>
                      {item.missed.length > 0 && <p className="cell-note">Buổi nghỉ: {item.missed.map((m) => missedKindLabels[m.kind] ?? m.kind).join(", ")}</p>}
                    </td>
                    <td className="num">
                      <strong>{formatMoney(item.amount)}</strong>
                      {item.joinSessions != null && <p className="cell-note">Vào giữa kỳ: {item.joinSessions}/{item.periodSessions} buổi</p>}
                      {item.discountAmount > 0 && <p className="cell-note">Miễn giảm −{formatMoney(item.discountAmount)}</p>}
                      {item.adjustmentAmount > 0 && <p className="cell-note">Giảm buổi nghỉ −{formatMoney(item.adjustmentAmount)}</p>}
                    </td>
                    <td className="num">{formatMoney(item.paid)}</td>
                    <td className="col-muted">{formatIsoDate(item.dueDate)}</td>
                    <td><ChargeBadge charge={item} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {center.receipts.filter((x) => !x.voidedAtUtc).length > 0 && (
        <>
          <p className="field-label">Đã đóng</p>
          <ul className="plain-list">
            {center.receipts.filter((x) => !x.voidedAtUtc).map((item) => (
              <li key={item.id} className="cell-note">{item.numberText} · {formatIsoDate(item.receivedOn)} · {paymentMethodLabels[item.method]} · <strong>{formatMoney(item.amount)}</strong></li>
            ))}
          </ul>
        </>
      )}
    </Panel>
  );
}
