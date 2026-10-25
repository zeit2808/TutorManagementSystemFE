import { ReceiptPrintPage } from "@/components/center/tuition-student";

export default async function ReceiptRoute({ params }: PageProps<"/centers/[centerId]/tuition/receipts/[receiptId]">) {
  const { receiptId } = await params;
  return <ReceiptPrintPage receiptId={receiptId} />;
}
