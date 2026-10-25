"use client";

import { useState } from "react";
import { FilePenLine, Globe, History, Undo2 } from "lucide-react";
import { organizationsApi, type Center, type CenterChangeProposal, type CenterChangeRequest, type CenterStatusChange } from "@/lib/api";
import { useAction, useResource } from "@/lib/hooks/use-resource";
import { formatDateTime } from "@/lib/format";
import { centerStatus, changeRequestStatus } from "@/lib/labels";
import { validateEmail, validateRequired, validateTaxCode, validateVietnamMobile, validateOptional } from "@/lib/validation";
import { Badge, Button, Dialog, EmptyState, ErrorNotice, Field, KeyValue, Notice, PageHeader, Panel, SkeletonRows, StateRail, Toggle } from "@/components/ui/primitives";
import { ConfirmDialog } from "@/components/ui/reason-dialog";
import { useCenter } from "./center-frame";

export const proposalFields: Array<{ key: keyof CenterChangeProposal; label: string }> = [
  { key: "legalName", label: "Tên pháp lý" },
  { key: "displayName", label: "Tên hiển thị" },
  { key: "taxCode", label: "Mã số thuế" },
  { key: "businessRegistrationNumber", label: "Số ĐKKD" },
  { key: "registeredAddress", label: "Địa chỉ đăng ký" },
  { key: "contactEmail", label: "Email liên hệ" },
  { key: "contactPhone", label: "Điện thoại liên hệ" },
];

export function centerLifecycle(status: string) {
  return (
    <StateRail
      label="Vòng đời trung tâm"
      current={status}
      steps={
        status === "Rejected"
          ? [{ id: "PendingApproval", label: "Chờ duyệt", tone: "warning" }, { id: "Rejected", label: "Bị từ chối", tone: "danger" }]
          : [
              { id: "PendingApproval", label: "Chờ duyệt", tone: "warning" },
              { id: "Approved", label: "Đang hoạt động", tone: "success" },
              { id: "Suspended", label: "Đình chỉ", tone: "danger" },
            ]
      }
    />
  );
}

export function CenterProfileWorkspace() {
  const { centerId, isOwner, canManage } = useCenter();
  const [composing, setComposing] = useState(false);
  const [withdrawing, setWithdrawing] = useState<CenterChangeRequest | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const profile = useResource(() => organizationsApi.getCenterProfile(centerId), [centerId]);
  const changes = useResource(() => (canManage ? organizationsApi.listCenterChanges(centerId) : Promise.resolve(null)), [centerId, canManage]);
  const history = useResource(() => (canManage ? organizationsApi.centerStatusHistory(centerId) : Promise.resolve(null)), [centerId, canManage]);
  const listing = useAction();

  const center = profile.data;
  const pending = changes.data?.find((item) => item.status === "Pending");

  return (
    <>
      <PageHeader
        title="Hồ sơ trung tâm"
        description="Thông tin pháp lý và liên hệ chỉ thay đổi qua yêu cầu được quản trị nền tảng duyệt; hồ sơ hiện tại giữ nguyên trong lúc chờ."
        meta={center && centerLifecycle(center.status)}
        actions={isOwner && center && <Button variant="primary" icon={<FilePenLine aria-hidden="true" />} disabled={Boolean(pending) || center.status !== "Approved"} onClick={() => setComposing(true)}>Đề xuất thay đổi</Button>}
      />
      {notice && <Notice tone="success" onDismiss={() => setNotice(null)}>{notice}</Notice>}
      {pending && <Notice tone="warning" title="Đang có yêu cầu chờ duyệt">Mỗi trung tâm chỉ có một yêu cầu chờ duyệt tại một thời điểm.</Notice>}
      <ErrorNotice error={profile.error} onReload={() => void profile.reload()} />

      <div className="detail-grid">
        <Panel title="Thông tin hiện hành">
          {!center ? <SkeletonRows rows={6} columns={2} /> : <div className="panel-body"><ProfileFacts center={center} /></div>}
        </Panel>

        <Panel title="Hiển thị trong danh bạ" description="Học sinh đăng nhập có thể tìm trung tâm theo tên và môn, xem các lớp đang mở đăng ký (tên lớp, môn, lịch tuần, giáo viên, số chỗ còn, ngày bắt đầu/kết thúc). Mã số thuế, địa chỉ và liên hệ không hiển thị.">
          <div className="panel-body directory-toggle">
            {!center ? <SkeletonRows rows={1} columns={2} /> : (
              <>
                <Toggle
                  checked={Boolean(center.listedInDirectory)}
                  disabled={!isOwner || listing.pending || center.status !== "Approved"}
                  label={center.listedInDirectory ? "Đang hiển thị trong danh bạ" : "Không hiển thị trong danh bạ"}
                  onChange={async (listed) => {
                    const updated = await listing.run(() => organizationsApi.setDirectoryListing(centerId, listed));
                    if (updated) {
                      profile.setData(updated);
                      setNotice(listed ? "Trung tâm đã hiện trong danh bạ tìm trung tâm của học sinh." : "Đã ẩn trung tâm khỏi danh bạ.");
                    }
                  }}
                />
                <p className="col-muted"><Globe aria-hidden="true" className="inline-icon" />{isOwner ? (center.status === "Approved" ? "Chỉ lớp đang mở đăng ký và còn chỗ mới hiện ra." : "Trung tâm cần được duyệt trước.") : "Chỉ chủ trung tâm bật hoặc tắt."}</p>
              </>
            )}
            <ErrorNotice error={listing.error} onDismiss={listing.clearError} />
          </div>
        </Panel>

        <Panel title="Lịch sử yêu cầu thay đổi" description={canManage ? "Bản gốc và bản đề xuất được lưu để đối chiếu." : undefined} flush>
          {!canManage ? (
            <EmptyState icon={<History aria-hidden="true" />} title="Chỉ chủ và quản lý trung tâm xem được">Yêu cầu thay đổi hồ sơ do chủ trung tâm gửi; quản lý được xem để theo dõi.</EmptyState>
          ) : !changes.data ? (
            <SkeletonRows rows={3} columns={2} />
          ) : changes.data.length === 0 ? (
            <EmptyState icon={<History aria-hidden="true" />} title="Chưa có yêu cầu nào" />
          ) : (
            <ul className="change-list">
              {changes.data.map((item) => (
                <ChangeRequestCard
                  key={item.id}
                  request={item}
                  actions={isOwner && item.status === "Pending" && (
                    <Button size="sm" icon={<Undo2 aria-hidden="true" />} onClick={() => setWithdrawing(item)}>Rút yêu cầu</Button>
                  )}
                />
              ))}
            </ul>
          )}
          <ErrorNotice error={changes.error} onReload={() => void changes.reload()} />
        </Panel>

        {canManage && (
          <Panel title="Lịch sử trạng thái" description="Mọi lần duyệt, từ chối, gửi lại, đình chỉ và khôi phục." flush>
            <ErrorNotice error={history.error} onReload={() => void history.reload()} />
            {!history.data ? <SkeletonRows rows={3} columns={2} /> : <StatusHistory items={history.data} />}
          </Panel>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(withdrawing)}
        title="Rút yêu cầu thay đổi?"
        confirmLabel="Rút yêu cầu"
        variant="danger"
        onClose={() => setWithdrawing(null)}
        onConfirm={async () => {
          if (!withdrawing) return;
          await organizationsApi.withdrawCenterChange(centerId, withdrawing.id);
          setNotice("Đã rút yêu cầu. Có thể gửi yêu cầu mới bất cứ lúc nào.");
          await changes.reload();
        }}
      >
        <p>Yêu cầu chưa được duyệt sẽ đóng lại với trạng thái “Đã rút”; hồ sơ hiện hành không đổi.</p>
      </ConfirmDialog>

      {composing && center && (
        <ChangeComposer
          center={center}
          onClose={() => setComposing(false)}
          onSubmitted={() => {
            setComposing(false);
            setNotice("Đã gửi yêu cầu thay đổi. Hồ sơ hiện hành giữ nguyên cho tới khi được duyệt.");
            void changes.reload();
          }}
        />
      )}
    </>
  );
}

export function StatusHistory({ items }: { items: CenterStatusChange[] }) {
  if (items.length === 0) return <p className="panel-empty">Chưa có lịch sử.</p>;
  return (
    <ol className="status-history">
      {[...items].reverse().map((item, index) => {
        const to = centerStatus[item.toStatus] ?? { label: item.toStatus, tone: "neutral" as const };
        return (
          <li key={`${item.changedAtUtc}-${index}`}>
            <div>
              <Badge tone={to.tone}>{to.label}</Badge>
              {item.fromStatus ? <span className="col-muted"> từ {centerStatus[item.fromStatus]?.label ?? item.fromStatus}</span> : <span className="col-muted"> · tạo hồ sơ</span>}
            </div>
            <small className="col-muted">{formatDateTime(item.changedAtUtc)}{item.actorName ? ` · ${item.actorName}` : ""}</small>
            {item.note && <p>{item.note}</p>}
          </li>
        );
      })}
    </ol>
  );
}

export function ProfileFacts({ center }: { center: Center }) {
  const status = centerStatus[center.status] ?? { label: center.status, tone: "neutral" as const };
  return (
    <KeyValue
      items={[
        { label: "Tên hiển thị", value: center.displayName },
        { label: "Tên pháp lý", value: center.legalName },
        { label: "Mã số thuế", value: <code className="code">{center.taxCode}</code> },
        { label: "Số ĐKKD", value: center.businessRegistrationNumber || "—" },
        { label: "Địa chỉ", value: center.address },
        { label: "Email liên hệ", value: center.contactEmail },
        { label: "Điện thoại", value: center.contactPhone },
        { label: "Trạng thái", value: <Badge tone={status.tone}>{status.label}</Badge> },
        { label: "Tạo lúc", value: formatDateTime(center.createdAtUtc) },
        { label: "Duyệt gần nhất", value: center.reviewedAtUtc ? `${formatDateTime(center.reviewedAtUtc)}${center.reviewNote ? ` · ${center.reviewNote}` : ""}` : "—" },
      ]}
    />
  );
}

export function ChangeRequestCard({ request, actions }: { request: CenterChangeRequest; actions?: React.ReactNode }) {
  const status = changeRequestStatus[request.status] ?? { label: request.status, tone: "neutral" as const };
  const diffs = proposalFields.filter((field) => (request.original[field.key] ?? "") !== (request.proposed[field.key] ?? ""));
  return (
    <li className="change-card">
      <header>
        <Badge tone={status.tone}>{status.label}</Badge>
        <span>Gửi {formatDateTime(request.createdAtUtc)}{request.requestedByName && ` · ${request.requestedByName}`}</span>
      </header>
      <table className="diff-table">
        <thead><tr><th>Trường</th><th>Hiện tại</th><th>Đề xuất</th></tr></thead>
        <tbody>
          {diffs.map((field) => (
            <tr key={field.key}>
              <th scope="row">{field.label}</th>
              <td><del>{request.original[field.key] || "—"}</del></td>
              <td><ins>{request.proposed[field.key] || "—"}</ins></td>
            </tr>
          ))}
        </tbody>
      </table>
      <KeyValue items={[{ label: "Lý do", value: request.reason }, { label: "Tham chiếu chứng từ", value: request.evidenceReference }, ...(request.reviewNote ? [{ label: "Ghi chú duyệt", value: `${request.reviewNote} (${formatDateTime(request.reviewedAtUtc)}${request.reviewedByName ? ` · ${request.reviewedByName}` : ""})` }] : [])]} />
      {actions && <footer>{actions}</footer>}
    </li>
  );
}

function ChangeComposer({ center, onClose, onSubmitted }: { center: Center; onClose: () => void; onSubmitted: () => void }) {
  const { centerId } = useCenter();
  const [values, setValues] = useState({
    legalName: center.legalName,
    displayName: center.displayName,
    taxCode: center.taxCode,
    businessRegistrationNumber: center.businessRegistrationNumber ?? "",
    registeredAddress: center.address,
    contactEmail: center.contactEmail,
    contactPhone: center.contactPhone,
    reason: "",
    evidenceReference: "",
  });
  const [touched, setTouched] = useState(false);
  const action = useAction();

  const errors: Record<string, string | null> = {
    legalName: validateRequired(values.legalName, 200, "Tên pháp lý"),
    displayName: validateRequired(values.displayName, 150, "Tên hiển thị"),
    taxCode: validateTaxCode(values.taxCode),
    businessRegistrationNumber: validateOptional(values.businessRegistrationNumber, 50, "Số ĐKKD"),
    registeredAddress: validateRequired(values.registeredAddress, 500, "Địa chỉ"),
    contactEmail: validateEmail(values.contactEmail),
    contactPhone: validateVietnamMobile(values.contactPhone),
    reason: validateRequired(values.reason, 1000, "Lý do"),
    evidenceReference: validateRequired(values.evidenceReference, 500, "Tham chiếu chứng từ"),
  };
  const unchanged =
    values.legalName.trim() === center.legalName && values.displayName.trim() === center.displayName && values.taxCode.trim() === center.taxCode &&
    (values.businessRegistrationNumber.trim() || null) === (center.businessRegistrationNumber || null) && values.registeredAddress.trim() === center.address &&
    values.contactEmail.trim() === center.contactEmail && values.contactPhone.trim() === center.contactPhone;
  const invalid = Object.values(errors).some(Boolean) || unchanged;

  async function submit() {
    setTouched(true);
    if (invalid) return;
    const result = await action.run(() =>
      organizationsApi.requestCenterChange(centerId, {
        legalName: values.legalName.trim(),
        displayName: values.displayName.trim(),
        taxCode: values.taxCode.trim(),
        businessRegistrationNumber: values.businessRegistrationNumber.trim() || null,
        registeredAddress: values.registeredAddress.trim(),
        contactEmail: values.contactEmail.trim(),
        contactPhone: values.contactPhone.replace(/[\s.()-]/g, ""),
        reason: values.reason.trim(),
        evidenceReference: values.evidenceReference.trim(),
      }),
    );
    if (result) onSubmitted();
  }

  const field = (key: keyof typeof values, label: string, options: { multiline?: boolean; hint?: string; span?: boolean; required?: boolean } = {}) => (
    <Field key={key} label={label} required={options.required ?? true} hint={options.hint} error={touched ? errors[key] : null} className={options.span ? "span-2" : undefined}>
      {(id, describedBy) =>
        options.multiline ? (
          <textarea id={id} aria-describedby={describedBy} rows={2} value={values[key]} onChange={(event) => setValues({ ...values, [key]: event.target.value })} />
        ) : (
          <input id={id} aria-describedby={describedBy} value={values[key]} onChange={(event) => setValues({ ...values, [key]: event.target.value })} />
        )
      }
    </Field>
  );

  return (
    <Dialog
      open
      size="lg"
      title="Đề xuất thay đổi hồ sơ"
      description="Gửi toàn bộ 7 trường như mong muốn sau thay đổi. Email liên hệ của trung tâm khác email đăng nhập của bạn."
      onClose={onClose}
      onSubmit={submit}
      footer={<><Button onClick={onClose} disabled={action.pending}>Hủy</Button><Button type="submit" variant="primary" pending={action.pending}>Gửi yêu cầu</Button></>}
    >
      {touched && unchanged && <Notice tone="warning">Bạn chưa thay đổi trường nào so với hồ sơ hiện hành.</Notice>}
      <div className="form-grid">
        {field("legalName", "Tên pháp lý", { span: true })}
        {field("displayName", "Tên hiển thị")}
        {field("taxCode", "Mã số thuế", { hint: "10 số, có thể kèm -XXX." })}
        {field("businessRegistrationNumber", "Số ĐKKD", { required: false })}
        {field("contactPhone", "Điện thoại liên hệ")}
        {field("registeredAddress", "Địa chỉ đăng ký", { span: true, multiline: true })}
        {field("contactEmail", "Email liên hệ", { span: true })}
        {field("reason", "Lý do thay đổi", { span: true, multiline: true })}
        {field("evidenceReference", "Tham chiếu chứng từ", { span: true, hint: "Số/ngày giấy phép, mã hồ sơ… Hệ thống chỉ lưu văn bản, chưa nhận tệp đính kèm." })}
      </div>
      <ErrorNotice error={action.error} />
    </Dialog>
  );
}
