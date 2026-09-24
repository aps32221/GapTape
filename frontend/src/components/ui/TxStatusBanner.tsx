import type { TxState } from "../../hooks/useTxStatus";

const STYLES: Record<TxState, string> = {
  idle: "hidden",
  pending: "border-brand-500/40 bg-brand-500/10 text-brand-300",
  success: "border-safe-500/40 bg-safe-500/10 text-safe-300",
  error: "border-danger-500/40 bg-danger-500/10 text-danger-300",
};

export function TxStatusBanner({ status, message }: { status: TxState; message: string }) {
  if (status === "idle") return null;
  return <div className={`rounded-lg border px-3 py-2 text-xs ${STYLES[status]}`}>{message}</div>;
}
