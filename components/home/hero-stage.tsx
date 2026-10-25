"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, CalendarDays, Check, CheckCircle2, ClipboardCheck, GraduationCap, LayoutDashboard, Presentation, UsersRound } from "lucide-react";

/*
 * Focal moment of the welcome page: a miniature of the real product plays one
 * operating day — sessions land in room lanes, a clashing booking is refused
 * and re-placed, then the attendance sheet fills and is submitted. Every beat
 * mirrors a backend rule (no overlapping class/teacher/room, submit only when
 * every student is marked). Illustrative data only.
 */

const START = 17 * 60;
const SPAN = 4 * 60;
const rooms = ["Phòng 101", "Phòng 202", "Phòng 203"];

type Block = { id: string; name: string; teacher: string; lane: number; start: number; dur: number; at: number };
const blocks: Block[] = [
  { id: "a", name: "Toán 9 · A", teacher: "Cô Lan", lane: 0, start: 18 * 60, dur: 90, at: 1 },
  { id: "b", name: "Ngữ văn 9 · B", teacher: "Thầy Đức", lane: 1, start: 17 * 60 + 30, dur: 90, at: 2 },
  { id: "c", name: "Tiếng Anh 8", teacher: "Cô Hà", lane: 2, start: 19 * 60 + 30, dur: 90, at: 3 },
];

const students = [
  { name: "Lê Hoàng An", mark: "Có mặt", tone: "success" },
  { name: "Vũ Bảo Châu", mark: "Có mặt", tone: "success" },
  { name: "Đỗ Gia Huy", mark: "Có phép", tone: "info" },
  { name: "Ngô Minh Khang", mark: "Muộn", tone: "warning" },
  { name: "Bùi Thảo Linh", mark: "Có mặt", tone: "success" },
];

const LAST_STEP = 17;
const TICK_MS = 720;

function pos(start: number, dur: number) {
  return { left: `${((start - START) / SPAN) * 100}%`, width: `${(dur / SPAN) * 100}%` };
}

export function HeroStage() {
  const ref = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState(0);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(media.matches);
    const timer = window.setTimeout(sync, 0);
    media.addEventListener("change", sync);
    return () => {
      window.clearTimeout(timer);
      media.removeEventListener("change", sync);
    };
  }, []);

  useEffect(() => {
    if (reduced) return;
    let visible = true;
    let interval: number | undefined;
    const start = () => {
      window.clearInterval(interval);
      interval = window.setInterval(() => setStep((current) => (current >= LAST_STEP ? 0 : current + 1)), TICK_MS);
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible && !document.hidden) start();
      else window.clearInterval(interval);
    });
    const onVisibility = () => (document.hidden || !visible ? window.clearInterval(interval) : start());
    if (ref.current) observer.observe(ref.current);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      window.clearInterval(interval);
    };
  }, [reduced]);

  const s = reduced ? 14 : step;
  const clashing = s >= 4 && s < 6;
  const placed = s >= 6;
  const marked = Math.max(0, Math.min(students.length, s - 7));
  const submitted = s >= 13;

  return (
    <div className={`stage${s === 0 ? " is-resetting" : ""}`} ref={ref} aria-label="Minh họa: một ngày vận hành trong hệ thống" role="img">
      <aside className="stage-rail" aria-hidden="true">
        <span className="stage-logo" />
        {[LayoutDashboard, CalendarDays, ClipboardCheck, Presentation, GraduationCap, UsersRound].map((Icon, index) => (
          <span key={index} className={index === (s >= 7 ? 2 : 1) ? "active" : ""}><Icon /></span>
        ))}
      </aside>

      <div className="stage-main" aria-hidden="true">
        <header className="stage-head">
          <div>
            <strong>Lịch dạy</strong>
            <span>Thứ Năm · ba phòng học</span>
          </div>
          <span className={`stage-chip ${clashing ? "tone-danger" : placed ? "tone-success" : "tone-neutral"}`}>
            {clashing ? <AlertTriangle /> : <CheckCircle2 />}
            {clashing ? "Trùng lịch phòng" : placed ? "4 buổi · không trùng" : `${Math.min(3, Math.max(0, s))} buổi`}
          </span>
        </header>

        <div className="stage-grid">
          <div className="stage-ruler">
            {["17:00", "18:00", "19:00", "20:00", "21:00"].map((label) => <span key={label}>{label}</span>)}
          </div>
          {rooms.map((room, lane) => (
            <div className="stage-lane" key={room}>
              <span className="stage-lane-label">{room}</span>
              <div className="stage-lane-track">
                {blocks.filter((block) => block.lane === lane).map((block) => (
                  <span key={block.id} className={`stage-block lane-${lane}${s >= block.at ? " is-in" : ""}`} style={pos(block.start, block.dur)}>
                    <b>{block.name}</b>
                    <i>{block.teacher}</i>
                  </span>
                ))}
                {lane === 0 && (
                  <span className={`stage-block stage-ghost${s >= 4 ? " is-in" : ""}${clashing ? " is-clash" : ""}${placed ? " is-moved" : ""}`} style={pos(placed ? 17 * 60 : 18 * 60 + 30, 90)}>
                    <b>Vật lý 9</b>
                    <i>{clashing ? "Phòng đã có buổi" : "Cô Mai"}</i>
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        <p className={`stage-toast${clashing ? " is-in tone-danger" : placed && s < 8 ? " is-in tone-success" : ""}`}>
          {clashing ? <><AlertTriangle />Phòng 101 đã có lịch 18:00–19:30 — không lưu được</> : <><Check />Đã chuyển Vật lý 9 sang Phòng 203, 17:00</>}
        </p>
      </div>

      <section className={`stage-sheet${s >= 7 ? " is-in" : ""}`} aria-hidden="true">
        <header>
          <div>
            <strong>Điểm danh · Toán 9 · A</strong>
            <span>18:00–19:30 · Phòng 101</span>
          </div>
          <span className={`stage-chip ${submitted ? "tone-success" : "tone-warning"}`}>{submitted ? "Đã nộp" : "Bản nháp"}</span>
        </header>
        <ul>
          {students.map((student, index) => {
            const done = index < marked;
            return (
              <li key={student.name}>
                <span className="stage-avatar">{student.name.split(" ").slice(-1)[0][0]}</span>
                <span className="stage-name">{student.name}</span>
                <span className={`stage-mark${done ? ` is-on tone-${student.tone}` : ""}`}>{done ? student.mark : "Chưa chọn"}</span>
              </li>
            );
          })}
        </ul>
        <footer className={submitted ? "is-done" : ""}>
          {submitted ? <><CheckCircle2 />Phiên bản 2 · lưu vết người nộp và thời điểm</> : `${students.length - marked} học sinh chưa chọn`}
        </footer>
      </section>
    </div>
  );
}
