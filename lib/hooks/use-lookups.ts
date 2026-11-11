"use client";

import { useCallback } from "react";
import {
  academicsApi,
  onDataChanged,
  organizationsApi,
  type Room,
  type Subject,
  type Teacher,
  type TeachingClass,
  type TeachingPage,
} from "@/lib/api";
import { useResource, type Resource } from "./use-resource";

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

async function fetchCenterLookups(centerId: string): Promise<CenterLookups> {
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

/*
 * Lookups (classes, teachers, rooms, subjects) back almost every center screen but change rarely, so
 * one copy per center is shared across pages for LOOKUP_TTL_MS. The cache lives in memory only (a page
 * reload starts clean) and is dropped:
 *  - after any successful write under /centers/{centerId}/ made from this tab (a class, teacher, room…);
 *  - on sign-out, and when a screen's reload button is pressed;
 *  - when the request fails, so the next screen retries instead of reusing the error.
 * Edits made by someone else show up within the TTL.
 */
const LOOKUP_TTL_MS = 60_000;
const lookupCache = new Map<string, { loadedAt: number; value: Promise<CenterLookups> }>();

if (typeof window !== "undefined") {
  onDataChanged((path) => {
    const centerId = path === null ? undefined : /^\/centers\/([^/?]+)/.exec(path)?.[1];
    invalidateCenterLookups(centerId);
  });
}

/** Forget one center's lookups, or every center's when no id is given. */
export function invalidateCenterLookups(centerId?: string) {
  if (centerId) lookupCache.delete(centerId);
  else lookupCache.clear();
}

export function loadCenterLookups(centerId: string): Promise<CenterLookups> {
  const cached = lookupCache.get(centerId);
  if (cached && Date.now() - cached.loadedAt < LOOKUP_TTL_MS) return cached.value;

  const entry = { loadedAt: Date.now(), value: fetchCenterLookups(centerId) };
  lookupCache.set(centerId, entry);
  entry.value.catch(() => {
    if (lookupCache.get(centerId) === entry) lookupCache.delete(centerId);
  });
  return entry.value;
}

export function useCenterLookups(centerId: string): Resource<CenterLookups> {
  const resource = useResource(() => loadCenterLookups(centerId), [centerId]);
  const { reload } = resource;
  // An explicit reload means "show me the latest", so it skips the cache.
  const freshReload = useCallback(async () => {
    invalidateCenterLookups(centerId);
    await reload();
  }, [centerId, reload]);
  return { ...resource, reload: freshReload };
}
