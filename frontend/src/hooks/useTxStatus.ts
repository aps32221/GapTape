import { useState } from "react";

export type TxState = "idle" | "pending" | "success" | "error";

export function useTxStatus() {
  const [status, setStatus] = useState<TxState>("idle");
  const [message, setMessage] = useState<string>("");

  async function run(label: string, fn: () => Promise<void>) {
    setStatus("pending");
    setMessage(label);
    try {
      await fn();
      setStatus("success");
      setMessage(`${label} — confirmed`);
    } catch (err: unknown) {
      setStatus("error");
      const e = err as { shortMessage?: string; message?: string };
      setMessage(e?.shortMessage || e?.message || String(err));
    }
  }

  function reset() {
    setStatus("idle");
    setMessage("");
  }

  return { status, message, run, reset };
}
