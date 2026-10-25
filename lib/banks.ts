/** Common Vietnamese banks with their NAPAS BIN, used for the VietQR transfer code (H10). */
export const BANKS: Array<{ bin: string; name: string }> = [
  { bin: "970436", name: "Vietcombank" },
  { bin: "970415", name: "VietinBank" },
  { bin: "970418", name: "BIDV" },
  { bin: "970405", name: "Agribank" },
  { bin: "970407", name: "Techcombank" },
  { bin: "970422", name: "MB Bank" },
  { bin: "970416", name: "ACB" },
  { bin: "970432", name: "VPBank" },
  { bin: "970423", name: "TPBank" },
  { bin: "970403", name: "Sacombank" },
  { bin: "970441", name: "VIB" },
  { bin: "970443", name: "SHB" },
  { bin: "970437", name: "HDBank" },
  { bin: "970426", name: "MSB" },
  { bin: "970448", name: "OCB" },
  { bin: "970440", name: "SeABank" },
  { bin: "970431", name: "Eximbank" },
  { bin: "970449", name: "LPBank" },
  { bin: "970428", name: "Nam A Bank" },
  { bin: "970409", name: "Bac A Bank" },
];

export function bankName(bin: string | null | undefined) {
  return BANKS.find((bank) => bank.bin === bin)?.name ?? bin ?? "";
}

/** VietQR image (img.vietqr.io) with the amount and transfer content filled in. */
export function vietQrUrl(input: { bankBin: string; accountNumber: string; accountName: string; amount?: number; content?: string }) {
  const params = new URLSearchParams();
  if (input.amount && input.amount > 0) params.set("amount", String(Math.round(input.amount)));
  if (input.content) params.set("addInfo", input.content);
  params.set("accountName", input.accountName);
  return `https://img.vietqr.io/image/${input.bankBin}-${encodeURIComponent(input.accountNumber)}-compact2.png?${params.toString()}`;
}
