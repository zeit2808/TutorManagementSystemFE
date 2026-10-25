"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, BookOpen } from "lucide-react";
import { ensureSession } from "@/lib/auth/session";

/** Quietly restores an existing session so returning users go straight to work. */
function useHasSession() {
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    let active = true;
    ensureSession().then(() => active && setSignedIn(true)).catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);
  return signedIn;
}

export function LandingNav() {
  const signedIn = useHasSession();
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={`landing-nav${scrolled ? " is-scrolled" : ""}`}>
      <Link className="brand" href="/"><span className="brand-mark"><BookOpen aria-hidden="true" /></span><strong>Quản Lý Dạy Thêm</strong></Link>
      <nav aria-label="Trang chủ">
        <a href="#quy-trinh">Quy trình</a>
        <a href="#vai-tro">Vai trò</a>
        <a href="#nguyen-tac">Nguyên tắc</a>
      </nav>
      {signedIn ? (
        <Link className="btn btn-primary" href="/select-center">Vào nơi làm việc <ArrowRight aria-hidden="true" /></Link>
      ) : (
        <Link className="btn btn-light" href="/login">Đăng nhập</Link>
      )}
    </header>
  );
}

export function HeroActions() {
  const signedIn = useHasSession();
  return (
    <div className="hero-actions">
      {signedIn ? (
        <Link className="btn btn-primary btn-lg" href="/select-center">Vào nơi làm việc <ArrowRight aria-hidden="true" /></Link>
      ) : (
        <Link className="btn btn-primary btn-lg" href="/login">Đăng nhập <ArrowRight aria-hidden="true" /></Link>
      )}
      <Link className="btn btn-outline-light btn-lg" href="/accept-invitation">Tôi có lời mời mở trung tâm</Link>
    </div>
  );
}
