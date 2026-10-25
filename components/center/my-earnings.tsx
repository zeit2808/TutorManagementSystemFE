"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, HandCoins, MessageSquareWarning } from "lucide-react";
import { payrollApi, type MyEarningsCenter, type MyEarningsMonth } from "@/lib/api";
import { useResource } from "@/lib/hooks/use-resource";
import { formatDateTime, formatHours, formatIsoDate, formatMoney, formatMonth } from "@/lib/format";
import { payrollModeLabels, paymentMethodLabels } from "@/lib/labels";
import { Badge, Button, EmptyState, ErrorNotice, Notice, PageHeader, Panel, SkeletonRows } from "@/components/ui/primitives";
import { ReasonDialog } from "@/components/ui/reason-dialog";
import { LineDetail } from "./payroll";

/** C15: what I earned in every center with payroll on, by month and year; drafts can be reported (C14). */
export function MyEarningsPage() {
  const thisYear = Number(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric" }).format(new Date()));
  const [year, setYear] = useState(thisYear);
  const data = useResource(() => payrollApi.myEarnings(year), [year]);
  const view = data.data;
  return (
    <>
      <PageHeader
        title="Thu nhập của tôi"
        description="Tiền dạy ở mọi trung tâm bạn tham gia, gộp theo tháng và theo năm. Tháng nháp còn thay đổi theo điểm danh và học phí; thấy sai thì bấm “Báo sai” trước khi trung tâm chốt."
        actions={
          <label className="select-inline"><span>Năm</span>
            <select value={year} onChange={(event) => setYear(Number(event.target.value))}>
              {[thisYear, thisYear - 1, thisYear - 2].map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </label>
        }
      />
      <ErrorNotice error={data.error} onReload={() => void data.reload()} />
      {!view ? <Panel><SkeletonRows rows={4} columns={4} /></Panel> : view.centers.length === 0 ? (
        <Panel><EmptyState icon={<HandCoins aria-hidden="true" />} title="Chưa có thu nhập">Trung tâm bạn dạy chưa bật lương / chia thu nhập, hoặc năm này chưa có buổi dạy nào được tính.</EmptyState></Panel>
      ) : (
        <>
          <dl className="money-strip" aria-label={`Năm ${view.year}`}>
            <div><dt>Thực nhận năm {view.year}</dt><dd>{formatMoney(view.yearNet)}</dd><span>{view.centers.length} trung tâm</span></div>
            <div><dt>Đã nhận</dt><dd>{formatMoney(view.yearPaid)}</dd><span>Theo phiếu chi</span></div>
            <div className={view.yearNet - view.yearPaid > 0 ? "is-warning" : undefined}><dt>Còn chờ nhận</dt><dd>{formatMoney(view.yearNet - view.yearPaid)}</dd><span>Gồm cả tháng nháp</span></div>
            <div><dt>Đã dạy</dt><dd>{view.yearSessions} buổi</dd><span>{formatHours(view.yearMinutes)}</span></div>
          </dl>
          {view.centers.length > 1 && (
            <Panel title="Gộp mọi trung tâm" flush>
              <MonthTable months={view.months} />
            </Panel>
          )}
          {view.centers.map((center) => <CenterEarnings key={center.centerId} center={center} onChanged={() => void data.reload()} />)}
        </>
      )}
    </>
  );
}

function MonthTable({ months, onOpen, open }: { months: MyEarningsMonth[]; onOpen?: (month: string) => void; open?: string | null }) {
  return (
    <div className="table-wrap">
      <table className="table">
        <thead><tr><th>Tháng</th><th className="num">Buổi · giờ</th><th className="num">Thực nhận</th><th className="num">Đã nhận</th><th className="num">Còn lại</th><th>Trạng thái</th></tr></thead>
        <tbody>
          {months.map((item) => (
            <tr key={item.month} className={onOpen ? "payroll-row" : undefined} onClick={onOpen ? () => onOpen(item.month) : undefined}>
              <td>
                {onOpen ? (
                  <button type="button" className="row-toggle" aria-expanded={open === item.month} onClick={(event) => { event.stopPropagation(); onOpen(item.month); }}>
                    {open === item.month ? <ChevronDown aria-hidden="true" /> : <ChevronRight aria-hidden="true" />}<strong>{formatMonth(item.month)}</strong>
                  </button>
                ) : <strong>{formatMonth(item.month)}</strong>}
              </td>
              <td className="num">{item.sessions} buổi<p className="cell-note">{formatHours(item.minutes)}</p></td>
              <td className="num"><strong>{formatMoney(item.net)}</strong></td>
              <td className="num">{formatMoney(item.paid)}</td>
              <td className="num">{formatMoney(item.remaining)}</td>
              <td>{item.status === "Closed" ? <Badge tone="success">Đã chốt</Badge> : <Badge tone="info">Nháp</Badge>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CenterEarnings({ center, onChanged }: { center: MyEarningsCenter; onChanged: () => void }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <Panel title={center.centerName} description={`${payrollModeLabels[center.mode]?.short ?? center.mode} · năm nay ${formatMoney(center.yearNet)}, đã nhận ${formatMoney(center.yearPaid)}`} flush>
      {center.months.length === 0 ? <p className="panel-empty">Năm này chưa có buổi dạy nào được tính ở đây.</p> : (
        <>
          <MonthTable months={center.months} open={open} onOpen={(month) => setOpen(open === month ? null : month)} />
          {open && <MonthDetail key={open} centerId={center.centerId} teacherIds={center.teacherIds} month={open} onChanged={onChanged} />}
        </>
      )}
    </Panel>
  );
}

function MonthDetail({ centerId, teacherIds, month, onChanged }: { centerId: string; teacherIds: string[]; month: string; onChanged: () => void }) {
  const data = useResource(() => payrollApi.month(centerId, month), [centerId, month]);
  const [reporting, setReporting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const view = data.data;
  if (!view) return <div className="panel-body">{data.error ? <ErrorNotice error={data.error} onReload={() => void data.reload()} /> : <SkeletonRows rows={2} columns={3} />}</div>;
  const mine = (id: string) => teacherIds.includes(id);
  const line = view.lines.find((x) => mine(x.teacherId));
  const draft = view.status === "Draft";
  return (
    <div className="panel-body payroll-my-detail">
      {notice && <Notice tone="success" onDismiss={() => setNotice(null)}>{notice}</Notice>}
      {line ? (
        <>
          <dl className="money-strip">
            <div><dt>{view.mode === "RevenueShare" ? "Được chia" : "Lương buổi"}</dt><dd>{formatMoney(line.base)}</dd><span>{line.sessions} buổi · {formatHours(line.minutes)}</span></div>
            <div><dt>Cộng / trừ, điều chỉnh</dt><dd>{formatMoney(line.adjustments + line.carried)}</dd><span>Điều chỉnh tháng trước {formatMoney(line.carried)}</span></div>
            <div><dt>Thực nhận</dt><dd>{formatMoney(line.net)}</dd><span>{draft ? "Nháp, còn thay đổi" : "Đã chốt"}</span></div>
            <div><dt>Đã nhận</dt><dd>{formatMoney(line.paid)}</dd><span>Còn {formatMoney(line.remaining)}</span></div>
          </dl>
          <LineDetail line={line} share={view.mode === "RevenueShare"} closed={!draft} />
        </>
      ) : <p className="cell-note">Tháng này bạn chưa có buổi dạy nào được tính.</p>}
      {view.adjustments.filter((x) => mine(x.teacherId)).length > 0 && (
        <>
          <p className="field-label">Khoản cộng / trừ</p>
          <ul className="plain-list">
            {view.adjustments.filter((x) => mine(x.teacherId) && !x.voidedAtUtc).map((x) => <li key={x.id} className="cell-note">{formatMoney(x.amount)} · {x.reason}</li>)}
          </ul>
        </>
      )}
      {view.payouts.filter((x) => mine(x.teacherId) && !x.voidedAtUtc).length > 0 && (
        <>
          <p className="field-label">Đã nhận</p>
          <ul className="plain-list">
            {view.payouts.filter((x) => mine(x.teacherId) && !x.voidedAtUtc).map((x) => (
              <li key={x.id} className="cell-note">{x.numberText} · {formatIsoDate(x.paidOn)} · {paymentMethodLabels[x.method] ?? x.method} · <strong>{formatMoney(x.amount)}</strong>{x.advance ? " · tạm ứng" : ""}</li>
            ))}
          </ul>
        </>
      )}
      {view.disputes.filter((x) => mine(x.teacherId)).length > 0 && (
        <>
          <p className="field-label">Báo sai</p>
          <ul className="plain-list">
            {view.disputes.filter((x) => mine(x.teacherId)).map((x) => (
              <li key={x.id} className="cell-note">{formatDateTime(x.createdAtUtc)} · {x.message} — {x.resolvedAtUtc ? `Đã xử lý: ${x.resolution}` : "chờ trung tâm xử lý"}</li>
            ))}
          </ul>
        </>
      )}
      {draft && <Button size="sm" icon={<MessageSquareWarning aria-hidden="true" />} onClick={() => setReporting(true)}>Báo sai</Button>}
      <ReasonDialog open={reporting} title={`Báo sai ${formatMonth(month).toLowerCase()}`} label="Điều gì chưa đúng?" confirmLabel="Gửi báo sai" minLength={3} maxLength={300}
        placeholder="Ví dụ: Thiếu buổi dạy thay ngày 19/02" onClose={() => setReporting(false)}
        onConfirm={async (message) => {
          const next = await payrollApi.addDispute(centerId, month, message);
          data.setData(next);
          setNotice("Đã gửi báo sai; trung tâm phải xử lý trước khi chốt tháng.");
          onChanged();
        }}>
        <p>Trung tâm sẽ thấy báo sai này và trả lời. Tháng chỉ chốt được khi mọi báo sai đã xử lý.</p>
      </ReasonDialog>
    </div>
  );
}
