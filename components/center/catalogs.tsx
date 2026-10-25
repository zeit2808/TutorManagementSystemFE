"use client";

import { useMemo, useState } from "react";
import { BookOpen, DoorOpen, GraduationCap, KeyRound, UsersRound } from "lucide-react";
import { academicsApi, identityApi, organizationsApi, type CenterMember, type Room, type Student, type Subject, type Teacher } from "@/lib/api";
import { validateCode, validateName, validateOptional, validateVietnamMobile } from "@/lib/validation";
import { formatPhone } from "@/lib/format";
import { useAction, useResource } from "@/lib/hooks/use-resource";
import { useSessionUser } from "@/lib/auth/session";
import { roleLabel } from "@/lib/labels";
import { Badge, Button, Dialog, ErrorNotice, Field } from "@/components/ui/primitives";
import { CatalogWorkspace, type CatalogConfig } from "./catalog-workspace";
import { useCenter } from "./center-frame";
import { StudentAccessActions, StudentAccountCell } from "./student-access";

const PAGE_SIZE = 25;

const compactPhone = (value: string) => value.replace(/[\s.()-]/g, "");

const codeColumn = { label: "Mã", className: "col-code", render: (item: { code: string }) => <code className="code">{item.code}</code> };

const subjectsConfig: CatalogConfig<Subject> = {
  title: "Môn học",
  description: "Danh mục môn dùng khi mở lớp. Mã và tên là duy nhất trong trung tâm, kể cả khi đã lưu trữ.",
  noun: "môn học",
  icon: <BookOpen aria-hidden="true" />,
  paged: true,
  serverSearch: true,
  columns: [
    codeColumn,
    { label: "Tên môn", render: (item) => <strong>{item.name}</strong> },
    { label: "Mô tả", className: "col-muted", render: (item) => item.description || "—" },
  ],
  searchText: (item) => `${item.code} ${item.name} ${item.description ?? ""}`,
  fields: [
    { key: "code", label: "Mã môn", required: true, uppercase: true, maxLength: 20, hint: "2–20 ký tự, tự chuyển chữ hoa. Ví dụ TOAN-9.", initial: (item) => item?.code ?? "", validate: validateCode },
    { key: "name", label: "Tên môn", required: true, maxLength: 100, initial: (item) => item?.name ?? "", validate: (value) => validateName(value, "Tên môn") },
    { key: "description", label: "Mô tả", multiline: true, maxLength: 500, initial: (item) => item?.description ?? "", validate: (value) => validateOptional(value, 500, "Mô tả") },
  ],
  archiveNote: "Không lưu trữ được khi môn còn lớp đang hoạt động.",
  load: async (centerId, page, includeArchived, search) => {
    const result = await academicsApi.listSubjects(centerId, { page, pageSize: PAGE_SIZE, includeArchived, search });
    return { items: result.items, total: result.totalCount, pageSize: result.pageSize };
  },
  create: (centerId, values) => academicsApi.createSubject(centerId, { code: values.code, name: values.name, description: values.description || null }),
  update: (centerId, item, values) => academicsApi.updateSubject(centerId, item.id, { code: values.code, name: values.name, description: values.description || null, expectedVersion: item.version }),
  archive: (centerId, item) => academicsApi.archiveSubject(centerId, item.id, item.version),
  reactivate: (centerId, item) => academicsApi.reactivateSubject(centerId, item.id, item.version),
  displayName: (item) => item.name,
};

const roomsConfig: CatalogConfig<Room> = {
  title: "Phòng học",
  description: "Phòng dùng để xếp buổi học. Sĩ số do lớp quyết định, phòng không có sức chứa.",
  noun: "phòng",
  icon: <DoorOpen aria-hidden="true" />,
  paged: true,
  serverSearch: true,
  columns: [
    codeColumn,
    { label: "Tên phòng", render: (item) => <strong>{item.name}</strong> },
    { label: "Vị trí", className: "col-muted", render: (item) => item.locationNote || "—" },
  ],
  searchText: (item) => `${item.code} ${item.name} ${item.locationNote ?? ""}`,
  fields: [
    { key: "code", label: "Mã phòng", required: true, uppercase: true, maxLength: 20, hint: "Ví dụ P101.", initial: (item) => item?.code ?? "", validate: validateCode },
    { key: "name", label: "Tên phòng", required: true, maxLength: 100, initial: (item) => item?.name ?? "", validate: (value) => validateName(value, "Tên phòng") },
    { key: "locationNote", label: "Ghi chú vị trí", multiline: true, maxLength: 200, hint: "Tầng, toà nhà, lối vào…", initial: (item) => item?.locationNote ?? "", validate: (value) => validateOptional(value, 200, "Ghi chú vị trí") },
  ],
  archiveNote: "Không lưu trữ được khi phòng còn buổi học sắp tới.",
  load: async (centerId, page, includeArchived, search) => {
    const result = await organizationsApi.listRooms(centerId, { page, pageSize: PAGE_SIZE, includeArchived, search });
    return { items: result.items, total: result.totalCount, pageSize: result.pageSize };
  },
  create: (centerId, values) => organizationsApi.createRoom(centerId, { code: values.code, name: values.name, locationNote: values.locationNote || null }),
  update: (centerId, item, values) => organizationsApi.updateRoom(centerId, item.id, { code: values.code, name: values.name, locationNote: values.locationNote || null, expectedVersion: item.version }),
  archive: (centerId, item) => organizationsApi.archiveRoom(centerId, item.id, item.version),
  reactivate: (centerId, item) => organizationsApi.reactivateRoom(centerId, item.id, item.version),
  displayName: (item) => item.name,
};

const teachersConfig: CatalogConfig<Teacher> = {
  title: "Giáo viên",
  description: "Hồ sơ giáo viên dùng để xếp lịch và ghi nhận người dạy thực tế. Gắn hồ sơ với tài khoản của thành viên để người đó thấy lịch dạy và tự điểm danh; chủ trung tâm có thể gắn chính tài khoản mình để tự đứng lớp.",
  noun: "giáo viên",
  icon: <UsersRound aria-hidden="true" />,
  paged: true,
  columns: [codeColumn, { label: "Họ và tên", render: (item) => <strong>{item.fullName}</strong> }],
  searchText: (item) => `${item.code} ${item.fullName}`,
  fields: [
    { key: "code", label: "Mã giáo viên", required: true, uppercase: true, editable: false, maxLength: 20, hint: "Ví dụ GV-001.", initial: (item) => item?.code ?? "", validate: validateCode },
    { key: "fullName", label: "Họ và tên", required: true, maxLength: 100, initial: (item) => item?.fullName ?? "", validate: (value) => validateName(value, "Họ và tên") },
  ],
  archiveNote: "Không lưu trữ được khi giáo viên còn buổi dạy sắp tới.",
  serverSearch: true,
  load: async (centerId, page, includeArchived, search) => {
    const result = await academicsApi.listTeachers(centerId, { page, pageSize: PAGE_SIZE, includeArchived, search });
    return { items: result.items, total: result.totalCount, pageSize: result.pageSize };
  },
  create: (centerId, values) => academicsApi.createTeacher(centerId, { code: values.code, fullName: values.fullName }),
  update: (centerId, item, values) => academicsApi.updateTeacher(centerId, item.id, { fullName: values.fullName, expectedVersion: item.version }),
  archive: (centerId, item) => academicsApi.archiveTeacher(centerId, item.id, item.version),
  reactivate: (centerId, item) => academicsApi.reactivateTeacher(centerId, item.id, item.version),
  displayName: (item) => item.fullName,
};

const studentsConfig: CatalogConfig<Student> = {
  title: "Học sinh",
  description: "Hồ sơ học sinh của trung tâm, kèm liên hệ phụ huynh. Hồ sơ tạo tay chưa có tài khoản: gửi “Link kích hoạt” để em đăng nhập Google và thấy lịch của mình.",
  noun: "học sinh",
  icon: <GraduationCap aria-hidden="true" />,
  paged: true,
  columns: [
    codeColumn,
    { label: "Họ và tên", render: (item) => <strong>{item.fullName}</strong> },
    {
      label: "Phụ huynh",
      render: (item) =>
        item.parentPhone ? (
          <span>{item.parentName}<br /><a className="text-link" href={`tel:${item.parentPhone}`}>{formatPhone(item.parentPhone)}</a></span>
        ) : (
          <Badge tone="warning">Chưa có liên hệ</Badge>
        ),
    },
    { label: "Tài khoản", render: (item) => <StudentAccountCell item={item} /> },
  ],
  searchText: (item) => `${item.code} ${item.fullName} ${item.parentPhone ?? ""}`,
  searchPlaceholder: "Tìm theo mã, tên học sinh hoặc số điện thoại phụ huynh…",
  fields: [
    { key: "code", label: "Mã học sinh", uppercase: true, editable: false, maxLength: 20, hint: "Để trống để hệ thống tự cấp mã HS-000001, HS-000002…", initial: (item) => item?.code ?? "", validate: (value) => (value.trim() ? validateCode(value) : null) },
    { key: "fullName", label: "Họ và tên", required: true, maxLength: 100, initial: (item) => item?.fullName ?? "", validate: (value) => validateName(value, "Họ và tên") },
    { key: "parentName", label: "Tên phụ huynh", required: true, maxLength: 100, initial: (item) => item?.parentName ?? "", validate: (value) => validateName(value, "Tên phụ huynh") },
    { key: "parentPhone", label: "Số điện thoại phụ huynh", required: true, maxLength: 20, hint: "Số di động Việt Nam, ví dụ 0912 345 678.", initial: (item) => (item?.parentPhone ? formatPhone(item.parentPhone) : ""), validate: (value) => validateVietnamMobile(value, true) },
  ],
  archiveNote: "Phải rút học sinh khỏi mọi lớp đang học trước khi lưu trữ.",
  serverSearch: true,
  load: async (centerId, page, includeArchived, search) => {
    const result = await academicsApi.listStudents(centerId, { page, pageSize: PAGE_SIZE, includeArchived, search });
    return { items: result.items, total: result.totalCount, pageSize: result.pageSize };
  },
  create: (centerId, values) =>
    academicsApi.createStudent(centerId, { code: values.code || null, fullName: values.fullName, parentName: values.parentName, parentPhone: compactPhone(values.parentPhone) }),
  update: (centerId, item, values) =>
    academicsApi.updateStudent(centerId, item.id, { fullName: values.fullName, parentName: values.parentName, parentPhone: compactPhone(values.parentPhone), expectedVersion: item.version }),
  archive: (centerId, item) => academicsApi.archiveStudent(centerId, item.id, item.version),
  reactivate: (centerId, item) => academicsApi.reactivateStudent(centerId, item.id, item.version),
  displayName: (item) => item.fullName,
};

export function SubjectsWorkspace() {
  return <CatalogWorkspace config={subjectsConfig} />;
}
export function RoomsWorkspace() {
  return <CatalogWorkspace config={roomsConfig} />;
}
export function TeachersWorkspace() {
  const { centerId, canManage, isOwner } = useCenter();
  const { user } = useSessionUser();
  const members = useResource(
    () => (canManage ? identityApi.listMembers(centerId) : Promise.resolve([] as CenterMember[])),
    [centerId, canManage],
  );
  const [linking, setLinking] = useState<{ teacher: Teacher; done: (teacher: Teacher) => void; notify: (message: string) => void } | null>(null);
  const memberData = members.data;

  const config = useMemo<CatalogConfig<Teacher>>(() => {
    const byUser = new Map((memberData ?? []).map((member) => [member.userId, member]));
    return {
      ...teachersConfig,
      columns: [
        ...teachersConfig.columns,
        {
          label: "Tài khoản đăng nhập",
          render: (item) => {
            if (!item.userId) return <span className="col-muted">Chưa gắn</span>;
            const member = byUser.get(item.userId);
            if (!canManage) return <Badge tone="info">Đã gắn</Badge>;
            if (!member) return <Badge tone="warning">Đã gắn · không còn là thành viên</Badge>;
            return (
              <span>
                {item.userId === user?.userId ? <strong>Tài khoản của tôi</strong> : <strong>{member.username ?? member.email}</strong>}
                {!member.isActive && <Badge tone="warning">Đã ngừng quyền</Badge>}
              </span>
            );
          },
        },
      ],
      rowExtra: isOwner
        ? (item, helpers) => (
            <Button size="sm" variant="ghost" icon={<KeyRound aria-hidden="true" />} onClick={() => setLinking({ teacher: item, done: helpers.replaceItem, notify: helpers.notify })}>
              Tài khoản
            </Button>
          )
        : undefined,
    };
  }, [memberData, canManage, isOwner, user?.userId]);

  return (
    <>
      <CatalogWorkspace config={config} />
      {linking && (
        <LinkTeacherAccountDialog
          teacher={linking.teacher}
          members={memberData ?? []}
          selfId={user?.userId}
          onClose={() => setLinking(null)}
          onSaved={(updated) => {
            linking.done(updated);
            linking.notify(updated.userId ? `Đã gắn tài khoản cho ${updated.fullName}.` : `Đã bỏ gắn tài khoản của ${updated.fullName}.`);
            setLinking(null);
          }}
        />
      )}
    </>
  );
}

function LinkTeacherAccountDialog({ teacher, members, selfId, onClose, onSaved }: { teacher: Teacher; members: CenterMember[]; selfId?: string; onClose: () => void; onSaved: (teacher: Teacher) => void }) {
  const { centerId } = useCenter();
  const [userId, setUserId] = useState(teacher.userId ?? "");
  const action = useAction();
  const active = members.filter((member) => member.isActive);

  async function save() {
    const updated = await action.run(() => academicsApi.linkTeacherAccount(centerId, teacher.id, userId || null, teacher.version));
    if (updated) onSaved(updated);
  }

  return (
    <Dialog
      open
      title={`Tài khoản của ${teacher.fullName}`}
      description="Người được gắn sẽ thấy các buổi mình dạy và tự điểm danh trong ngày. Mỗi tài khoản gắn với tối đa một hồ sơ giáo viên trong trung tâm."
      onClose={onClose}
      onSubmit={save}
      footer={
        <>
          <Button onClick={onClose} disabled={action.pending}>Hủy</Button>
          <Button type="submit" variant="primary" pending={action.pending} disabled={(teacher.userId ?? "") === userId}>Lưu</Button>
        </>
      }
    >
      <Field label="Thành viên" hint="Chưa thấy người cần gắn? Mời họ ở mục Thành viên trước.">
        {(id, describedBy) => (
          <select id={id} aria-describedby={describedBy} value={userId} onChange={(event) => setUserId(event.target.value)}>
            <option value="">Không gắn tài khoản</option>
            {active.map((member) => (
              <option key={member.userId} value={member.userId}>
                {member.userId === selfId ? "Tôi" : member.username ?? member.email} · {roleLabel(member.role)}
              </option>
            ))}
          </select>
        )}
      </Field>
      <ErrorNotice error={action.error} />
    </Dialog>
  );
}
export function StudentsWorkspace() {
  const { canManage } = useCenter();
  const config = useMemo<CatalogConfig<Student>>(() => ({
    ...studentsConfig,
    rowExtra: canManage
      ? (item, helpers) => <StudentAccessActions item={item} onChanged={helpers.replaceItem} notify={helpers.notify} reload={helpers.reload} />
      : undefined,
  }), [canManage]);
  return <CatalogWorkspace config={config} />;
}
