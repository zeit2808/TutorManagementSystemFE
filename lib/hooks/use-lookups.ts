"use client";

import { academicsApi, organizationsApi, type Room, type Subject, type Teacher, type TeachingClass, type TeachingPage } from "@/lib/api";
import { useResource } from "./use-resource";

/** The API caps pageSize at 100; walk every page so lookups are complete. */
export async function fetchAllPages<T>(load: (page: number) => Promise<TeachingPage<T>>, limit = 20): Promise<T[]> {
  const first = await load(1);
  const items = [...first.items];
  const pages = Math.min(Math.ceil(first.totalCount / Math.max(first.pageSize, 1)), limit);
  for (let page = 2; page <= pages; page += 1) {
    const next = await load(page);
    items.push(...next.items);
  }
  return items;
}

export interface CenterLookups {
  classes: TeachingClass[];
  teachers: Teacher[];
  rooms: Room[];
  subjects: Subject[];
  classById: Map<string, TeachingClass>;
  teacherById: Map<string, Teacher>;
  roomById: Map<string, Room>;
  subjectById: Map<string, Subject>;
}

export async function loadCenterLookups(centerId: string): Promise<CenterLookups> {
  // Session/series DTOs carry only IDs, so names are joined client-side.
  const [classes, teachers, rooms, subjects] = await Promise.all([
    fetchAllPages((page) => academicsApi.listClasses(centerId, { page, pageSize: 100, includeArchived: true })),
    fetchAllPages((page) => academicsApi.listTeachers(centerId, { page, pageSize: 100, includeArchived: true })),
    organizationsApi.listAllRooms(centerId, true),
    academicsApi.listAllSubjects(centerId, true),
  ]);
  return {
    classes,
    teachers,
    rooms,
    subjects,
    classById: new Map(classes.map((item) => [item.id, item])),
    teacherById: new Map(teachers.map((item) => [item.id, item])),
    roomById: new Map(rooms.map((item) => [item.id, item])),
    subjectById: new Map(subjects.map((item) => [item.id, item])),
  };
}

export function useCenterLookups(centerId: string) {
  return useResource(() => loadCenterLookups(centerId), [centerId]);
}
