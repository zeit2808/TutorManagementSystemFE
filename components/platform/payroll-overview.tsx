"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Coins, RefreshCcw, Search, Settings2 } from "lucide-react";
import { ApiError, payrollApi, type PayrollCenterConfigSummary } from "@/lib/api";
import { useResource } from "@/lib/hooks/use-resource";
import { formatDateTime, formatMonth } from "@/lib/format";
import { centerStatus } from "@/lib/labels";
import { Badge, Button, EmptyState, ErrorNotice, Notice, PageHeader, Panel, Segmented, SkeletonRows } from "@/components/ui/primitives";
import { PayrollConfigDialogLoader, PayrollStateBadge } from "./payroll-config";

type Filter = "all" | "RevenueShare" | "PerSession" | "off" | "scheduled";

/**
 * A1/A2: the platform admin's one place for payroll — every operating center, what applies this month, what is
 * scheduled for next month, and a button to configure. Never shows the centers' money.
 */
export function PlatformPayrollOverview() {
  const overview = useResource(() => payrollApi.configOverview(), []);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<PayrollCenterConfigSummary | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const centers = overview.data?.centers;

  const counts = useMemo(() => {
    const list = centers ?? [];
    return {
      all: list.length,
      RevenueShare: list.filter((x) => x.enabledThisMonth && x.modeThisMonth === "RevenueShare").length,
      PerSession: list.filter((x) => x.enabledThisMonth && x.modeThisMonth === "PerSession").length,
      off: list.filter((x) => !x.enabledThisMonth).length,
      scheduled: list.filter((x) => x.nextMonth).length,
    };
  }, [centers]);

  const rows = useMemo(() => {
    const term = query.trim().toLowerCase();
    return (centers ?? []).filter((x) =>
      (filter === "all" ||
        (filter === "off" && !x.enabledThisMonth) ||
        (filter === "scheduled" && x.nextMonth) ||
        (x.enabledThisMonth && x.modeThisMonth === filter)) &&
      (!term || x.centerName.toLowerCase().includes(term)));
  }, [centers, filter, query]);

  return (
    <>
      <PageHeader title="Lương & chia thu nhập"
        description="Bật chức năng cho từng trung tâm và chọn cách tính: Chia thu nhập (hộ gia đình) hoặc Lương giáo viên (theo buổi). Đổi cách tính có hiệu lực từ đầu tháng; admin không xem được tiền của trung tâm."
        actions={<Button icon={<RefreshCcw aria-hidden="true" />} onClick={() => void overview.reload()} pending={overview.loading && Boolean(overview.data)}>Làm mới</Button>} />
      {notice && <Notice tone="success" onDismiss={() => setNotice(null)}>{notice}</Notice>}
      {overview.error instanceof ApiError && overview.error.status === 404 ? (
        <Notice tone="warning" title="API đang chạy bản cũ">
          Máy chủ chưa có chức năng này. Tắt API rồi chạy lại (dotnet run sẽ build bản mới), sau đó bấm Làm mới.
        </Notice>
      ) : <ErrorNotice error={overview.error} onReload={() => void overview.reload()} />}

      {overview.data && (
        <dl className="money-strip" aria-label={`Tình trạng ${formatMonth(overview.data.currentMonth).toLowerCase()}`}>
          <div><dt>Chia thu nhập</dt><dd>{counts.RevenueShare}</dd><span>Trung tâm đang bật · {formatMonth(overview.data.currentMonth).toLowerCase()}</span></div>
          <div><dt>Lương giáo viên</dt><dd>{counts.PerSession}</dd><span>Trung tâm đang bật · {formatMonth(overview.data.currentMonth).toLowerCase()}</span></div>
          <div><dt>Chưa bật</dt><dd>{counts.off}</dd><span>Không có menu lương</span></div>
          <div className={counts.scheduled > 0 ? "is-warning" : undefined}><dt>Đổi từ tháng sau</dt><dd>{counts.scheduled}</dd><span>Đã hẹn, chưa áp dụng</span></div>
        </dl>
      )}

      <Panel flush>
        <div className="toolbar">
          <Segmented label="Lọc theo cách tính" value={filter} onChange={setFilter} options={[
            { value: "all", label: "Tất cả", count: counts.all },
            { value: "RevenueShare", label: "Chia thu nhập", count: counts.RevenueShare },
            { value: "PerSession", label: "Lương giáo viên", count: counts.PerSession },
            { value: "off", label: "Chưa bật", count: counts.off },
            { value: "scheduled", label: "Đổi từ tháng sau", count: counts.scheduled },
          ]} />
          <label className="search">
            <Search aria-hidden="true" />
            <span className="sr-only">Tìm trung tâm</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tên trung tâm…" />
          </label>
        </div>
        {!centers ? <SkeletonRows rows={5} columns={5} /> : rows.length === 0 ? (
          <EmptyState icon={<Coins aria-hidden="true" />} title={centers.length === 0 ? "Chưa có trung tâm đang hoạt động" : "Không có trung tâm phù hợp"}>
            {centers.length === 0 ? "Duyệt một trung tâm ở mục Trung tâm trước, rồi bật lương ở đây." : "Đổi bộ lọc hoặc từ khoá tìm kiếm."}
          </EmptyState>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr>
                <th>Trung tâm</th>
                <th>{overview.data ? formatMonth(overview.data.currentMonth) : "Tháng này"}</th>
                <th>Thay đổi đã hẹn</th>
                <th>Tháng chốt gần nhất</th>
                <th>Đổi lần cuối</th>
                <th className="col-actions"><span className="sr-only">Cấu hình</span></th>
              </tr></thead>
              <tbody>
                {rows.map((row) => {
                  const status = centerStatus[row.centerStatus] ?? { label: row.centerStatus, tone: "neutral" as const };
                  return (
                    <tr key={row.centerId}>
                      <td>
                        <Link className="row-link" href={`/platform/centers/${row.centerId}`}>{row.centerName}</Link>
                        {row.centerStatus !== "Approved" && <><br /><Badge tone={status.tone}>{status.label}</Badge></>}
                      </td>
                      <td><PayrollStateBadge enabled={row.enabledThisMonth} mode={row.modeThisMonth} /></td>
                      <td>{row.nextMonth
                        ? <>Từ {formatMonth(row.nextMonth).toLowerCase()}: <PayrollStateBadge enabled={Boolean(row.nextEnabled)} mode={row.nextMode ?? ""} /></>
                        : <span className="col-muted">—</span>}</td>
                      <td>{row.latestClosedMonth ? formatMonth(row.latestClosedMonth) : <span className="col-muted">—</span>}</td>
                      <td className="col-muted">{row.lastChangedAtUtc ? <>{formatDateTime(row.lastChangedAtUtc)}{row.lastChangedBy && <><br />{row.lastChangedBy}</>}</> : "Chưa cấu hình"}</td>
                      <td className="col-actions">
                        <Button size="sm" variant={row.lastChangedAtUtc ? "secondary" : "primary"} icon={<Settings2 aria-hidden="true" />} onClick={() => setEditing(row)}>
                          {row.lastChangedAtUtc ? "Cấu hình" : "Bật"}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {editing && (
        <PayrollConfigDialogLoader centerId={editing.centerId} centerName={editing.centerName}
          onClose={() => setEditing(null)}
          onSaved={(message) => { setEditing(null); setNotice(`Đã lưu — ${message}`); void overview.reload(); }} />
      )}
    </>
  );
}
