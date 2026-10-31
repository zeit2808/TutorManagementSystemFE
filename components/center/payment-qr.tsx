"use client";

import { useMemo, type ReactNode } from "react";
import qrcode from "qrcode-generator";
import type { PaymentIntent } from "@/lib/api";
import { bankName } from "@/lib/banks";
import { formatDateTime, formatMoney } from "@/lib/format";
import { useResource } from "@/lib/hooks/use-resource";
import { ErrorNotice, SkeletonRows } from "@/components/ui/primitives";

/** Drawn here so the account and amount never leave for a third-party image service. */
function qrImage(payload: string) {
  const qr = qrcode(0, "M");
  qr.addData(payload, "Byte");
  qr.make();
  return `data:image/svg+xml,${encodeURIComponent(qr.createSvgTag({ cellSize: 4, margin: 16, scalable: true }))}`;
}

function QrCard({ intent, note }: { intent: PaymentIntent; note?: ReactNode }) {
  const image = useMemo(() => qrImage(intent.qrPayload), [intent.qrPayload]);
  return (
    <div className="qr-box">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={image} alt={`Mã VietQR chuyển ${formatMoney(intent.amount)}`} width={220} height={220} />
      <p><strong>{formatMoney(intent.amount)}</strong></p>
      <p className="cell-note">{bankName(intent.bank.bankBin)} · {intent.bank.accountNumber} · {intent.bank.accountName}</p>
      <p className="cell-note">Nội dung: <code className="code">{intent.transferContent}</code></p>
      <p className="cell-note">Giữ nguyên số tiền và nội dung khi chuyển. Mã dùng đến {formatDateTime(intent.expiresAtUtc)}.</p>
      {note && <p className="cell-note">{note}</p>}
    </div>
  );
}

/** The QR code the server made for what is owed; hidden while a new one loads so an old amount is never scanned. */
export function PaymentQr({ load, deps, note }: { load: () => Promise<PaymentIntent>; deps: unknown[]; note?: ReactNode }) {
  const intent = useResource(load, deps);
  if (intent.error) return <ErrorNotice error={intent.error} onReload={() => void intent.reload()} />;
  if (intent.loading || !intent.data) return <SkeletonRows rows={3} columns={1} />;
  return <QrCard intent={intent.data} note={note} />;
}
