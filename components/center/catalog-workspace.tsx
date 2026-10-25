"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Archive, ArchiveRestore, Database, Pencil, Plus, RefreshCcw, Search } from "lucide-react";
import { useCenter } from "./center-frame";
import { useAction, useResource } from "@/lib/hooks/use-resource";
import { Badge, Button, Dialog, EmptyState, ErrorNotice, Field, Notice, PageHeader, Pagination, Panel, SkeletonRows, Toggle } from "@/components/ui/primitives";
import { ConfirmDialog } from "@/components/ui/reason-dialog";

export interface CatalogItem {
  id: string;
  code: string;
  isActive: boolean;
  version: number;
}

export interface CatalogField<T> {
  key: string;
  label: string;
  required?: boolean;
  multiline?: boolean;
  hint?: string;
  maxLength?: number;
  /** false → only on create (backend keeps it immutable). */
  editable?: boolean;
  uppercase?: boolean;
  initial: (item?: T) => string;
  validate: (value: string) => string | null;
}

export interface CatalogConfig<T extends CatalogItem> {
  title: string;
  description: string;
  noun: string;
  icon: ReactNode;
  paged: boolean;
  columns: Array<{ label: string; render: (item: T) => ReactNode; className?: string }>;
  searchText: (item: T) => string;
  fields: Array<CatalogField<T>>;
  archiveNote: string;
  /** search is passed only when serverSearch is true; otherwise filtering happens on the loaded page. */
  load: (centerId: string, page: number, includeArchived: boolean, search?: string) => Promise<{ items: T[]; total: number; pageSize: number }>;
  serverSearch?: boolean;
  searchPlaceholder?: string;
  create: (centerId: string, values: Record<string, string>) => Promise<T>;
  update: (centerId: string, item: T, values: Record<string, string>) => Promise<T>;
  archive: (centerId: string, item: T) => Promise<T>;
  reactivate: (centerId: string, item: T) => Promise<T>;
  displayName: (item: T) => string;
  /** Extra action for an active row (e.g. linking a teacher login). */
  rowExtra?: (item: T, helpers: { replaceItem: (item: T) => void; notify: (message: string) => void; reload: () => void }) => ReactNode;
}

type Editor<T> = { mode: "create" } | { mode: "edit"; item: T } | null;

export function CatalogWorkspace<T extends CatalogItem>({ config }: { config: CatalogConfig<T> }) {
  const { centerId, canManage } = useCenter();
  const [page, setPage] = useState(1);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [query, setQuery] = useState("");
  const [editor, setEditor] = useState<Editor<T>>(null);
  const [archiving, setArchiving] = useState<T | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const rowAction = useAction();

  // Server-side search waits for typing to pause so each keystroke is not a request.
  const [search, setSearch] = useState("");
  useEffect(() => {
    if (!config.serverSearch) return;
    const timer = window.setTimeout(() => {
      const next = query.trim();
      setSearch((current) => {
        if (current !== next) setPage(1);
        return next;
      });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [query, config.serverSearch]);

  const resource = useResource(
    () => config.load(centerId, page, includeArchived, config.serverSearch ? search || undefined : undefined),
    [centerId, page, includeArchived, config.serverSearch ? search : ""],
  );
  const items = resource.data?.items;
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!items) return [];
    if (config.serverSearch) return items;
    return needle ? items.filter((item) => config.searchText(item).toLowerCase().includes(needle)) : items;
  }, [items, query, config]);

  function replaceItem(updated: T) {
    resource.setData((current) => current ? { ...current, items: current.items.map((item) => (item.id === updated.id ? updated : item)) } : current!);
  }

  async function reactivate(item: T) {
    const updated = await rowAction.run(() => config.reactivate(centerId, item));
    if (updated) {
      replaceItem(updated);
      setNotice(`Đã khôi phục ${config.noun} ${config.displayName(updated)}.`);
    }
  }

  return (
    <>
      <PageHeader
        title={config.title}
        description={config.description}
        actions={
          <>
            <Button icon={<RefreshCcw aria-hidden="true" />} onClick={() => void resource.reload()} pending={resource.loading && Boolean(items)}>Làm mới</Button>
            {canManage && <Button variant="primary" icon={<Plus aria-hidden="true" />} onClick={() => setEditor({ mode: "create" })}>Thêm {config.noun}</Button>}
          </>
        }
      />

      {notice && <Notice tone="success" onDismiss={() => setNotice(null)}>{notice}</Notice>}
      <ErrorNotice error={resource.error} onReload={() => void resource.reload()} />
      <ErrorNotice error={rowAction.error} onReload={() => void resource.reload()} onDismiss={rowAction.clearError} />

      <Panel flush>
        <div className="toolbar">
          <label className="search">
            <Search aria-hidden="true" />
            <span className="sr-only">Tìm {config.noun}</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={config.searchPlaceholder ?? `Tìm theo mã hoặc tên ${config.noun}…`} />
          </label>
          <Toggle checked={includeArchived} onChange={(value) => { setIncludeArchived(value); setPage(1); }} label="Hiện cả bản ghi đã lưu trữ" />
          {config.paged && !config.serverSearch && <span className="toolbar-note">Tìm kiếm áp dụng trên trang đang xem</span>}
        </div>

        {!items ? (
          <SkeletonRows rows={6} columns={config.columns.length + 1} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={query ? <Search aria-hidden="true" /> : <Database aria-hidden="true" />}
            title={query ? "Không có kết quả phù hợp" : `Chưa có ${config.noun} nào`}
            action={!query && canManage ? <Button variant="primary" icon={<Plus aria-hidden="true" />} onClick={() => setEditor({ mode: "create" })}>Thêm {config.noun} đầu tiên</Button> : undefined}
          >
            {query ? "Thử từ khoá ngắn hơn hoặc bật hiển thị bản ghi đã lưu trữ." : canManage ? `Mã ${config.noun} là duy nhất trong trung tâm và không thể dùng lại sau khi lưu trữ.` : "Chủ hoặc quản lý trung tâm sẽ thêm dữ liệu ở đây."}
          </EmptyState>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  {config.columns.map((column) => <th key={column.label} className={column.className}>{column.label}</th>)}
                  <th>Trạng thái</th>
                  {canManage && <th className="col-actions"><span className="sr-only">Thao tác</span></th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => (
                  <tr key={item.id} className={item.isActive ? "" : "is-archived"}>
                    {config.columns.map((column) => <td key={column.label} className={column.className}>{column.render(item)}</td>)}
                    <td>{item.isActive ? <Badge tone="success">Đang hoạt động</Badge> : <Badge tone="neutral">Đã lưu trữ</Badge>}</td>
                    {canManage && (
                      <td className="col-actions">
                        {item.isActive ? (
                          <>
                            {config.rowExtra?.(item, { replaceItem, notify: setNotice, reload: () => void resource.reload() })}
                            <Button size="sm" variant="ghost" icon={<Pencil aria-hidden="true" />} onClick={() => setEditor({ mode: "edit", item })}>Sửa</Button>
                            <Button size="sm" variant="ghost" icon={<Archive aria-hidden="true" />} onClick={() => setArchiving(item)}>Lưu trữ</Button>
                          </>
                        ) : (
                          <Button size="sm" variant="ghost" icon={<ArchiveRestore aria-hidden="true" />} pending={rowAction.pending} onClick={() => void reactivate(item)}>Khôi phục</Button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {config.paged && resource.data && <Pagination page={page} pageSize={resource.data.pageSize} total={resource.data.total} onChange={setPage} />}
      </Panel>

      {editor && (
        <CatalogEditor
          config={config}
          editor={editor}
          onClose={() => setEditor(null)}
          onSaved={(saved, created) => {
            setEditor(null);
            setNotice(created ? `Đã thêm ${config.noun} ${config.displayName(saved)}.` : `Đã cập nhật ${config.noun} ${config.displayName(saved)}.`);
            if (created) void resource.reload();
            else replaceItem(saved);
          }}
          onStale={() => void resource.reload()}
        />
      )}

      <ConfirmDialog
        open={Boolean(archiving)}
        title={`Lưu trữ ${config.noun}?`}
        confirmLabel="Lưu trữ"
        variant="danger"
        onClose={() => setArchiving(null)}
        onConfirm={async () => {
          if (!archiving) return;
          const updated = await config.archive(centerId, archiving);
          replaceItem(updated);
          setNotice(`Đã lưu trữ ${config.noun} ${config.displayName(updated)}.`);
        }}
      >
        {archiving && (
          <p>
            <strong>{config.displayName(archiving)}</strong> sẽ ẩn khỏi các lựa chọn mới nhưng giữ nguyên lịch sử. {config.archiveNote}
          </p>
        )}
      </ConfirmDialog>
    </>
  );
}

function CatalogEditor<T extends CatalogItem>({ config, editor, onClose, onSaved, onStale }: { config: CatalogConfig<T>; editor: NonNullable<Editor<T>>; onClose: () => void; onSaved: (item: T, created: boolean) => void; onStale: () => void }) {
  const { centerId } = useCenter();
  const item = editor.mode === "edit" ? editor.item : undefined;
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(config.fields.map((field) => [field.key, field.initial(item)])));
  const [touched, setTouched] = useState(false);
  const action = useAction();

  const errors = Object.fromEntries(config.fields.map((field) => [field.key, field.validate(values[field.key] ?? "")]));
  const invalid = Object.values(errors).some(Boolean);

  async function submit() {
    setTouched(true);
    if (invalid) return;
    const payload = Object.fromEntries(config.fields.map((field) => [field.key, field.uppercase ? values[field.key].trim().toUpperCase() : values[field.key].trim()]));
    const saved = await action.run(() => (item ? config.update(centerId, item, payload) : config.create(centerId, payload)));
    if (saved) onSaved(saved, !item);
  }

  return (
    <Dialog
      open
      title={item ? `Sửa ${config.noun}` : `Thêm ${config.noun}`}
      description={item ? `Phiên bản đang sửa: ${item.version}. Nếu người khác vừa lưu, hệ thống sẽ từ chối để tránh ghi đè.` : undefined}
      onClose={onClose}
      onSubmit={submit}
      footer={
        <>
          <Button onClick={onClose} disabled={action.pending}>Hủy</Button>
          <Button type="submit" variant="primary" pending={action.pending}>{item ? "Lưu thay đổi" : `Thêm ${config.noun}`}</Button>
        </>
      }
    >
      <div className="form-grid">
        {config.fields.map((field) => {
          const locked = Boolean(item) && field.editable === false;
          return (
            <Field key={field.key} label={field.label} required={field.required} hint={locked ? "Không đổi được sau khi tạo." : field.hint} error={touched ? errors[field.key] : null} className={field.multiline ? "span-2" : undefined}>
              {(id, describedBy) =>
                field.multiline ? (
                  <textarea id={id} aria-describedby={describedBy} rows={3} maxLength={field.maxLength} value={values[field.key]} onChange={(event) => setValues({ ...values, [field.key]: event.target.value })} />
                ) : (
                  <input
                    id={id}
                    aria-describedby={describedBy}
                    value={values[field.key]}
                    maxLength={field.maxLength}
                    readOnly={locked}
                    className={field.uppercase ? "input-code" : undefined}
                    onChange={(event) => setValues({ ...values, [field.key]: event.target.value })}
                  />
                )
              }
            </Field>
          );
        })}
      </div>
      <ErrorNotice error={action.error} onReload={onStale} />
    </Dialog>
  );
}
