import { useEffect, useState } from "react";
import { sendCodOtpApi, verifyCodOtpApi } from "../services/checkoutService";

// Phone verification for COD orders. The code is checked by the server; this
// component only collects it.
export default function CodOtpPanel({ orderId, onVerified }) {
  const [sent, setSent] = useState(null); // { phoneLast4 }
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const send = async () => {
    setBusy(true);
    setError("");
    try {
      setSent(await sendCodOtpApi(orderId));
      setCooldown(30);
    } catch (err) {
      setError(err.message);
      if (err.code === "OTP_COOLDOWN") setCooldown(30);
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    setBusy(true);
    setError("");
    try {
      await verifyCodOtpApi(orderId, code);
      onVerified();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 space-y-3 text-sm">
      <p className="text-[var(--muted)]">Verify your phone number before paying the COD token.</p>
      {!sent ? (
        <button onClick={send} disabled={busy} className="rounded-full bg-ink-950 px-6 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-ink-950">
          {busy ? "Sending..." : "Send verification code"}
        </button>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-[var(--muted)]">Code sent to number ending {sent.phoneLast4}.</p>
          <div className="flex gap-2">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              placeholder="6-digit code"
              className="w-40 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 tracking-widest"
            />
            <button onClick={verify} disabled={busy || code.length !== 6} className="rounded-full bg-ink-950 px-5 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-ink-950">Verify</button>
            <button onClick={send} disabled={busy || cooldown > 0} className="rounded-full border border-[var(--border)] px-4 py-2 text-xs disabled:opacity-50">
              {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend"}
            </button>
          </div>
        </div>
      )}
      {error && <p className="text-xs text-[var(--color-danger)]">{error}</p>}
    </div>
  );
}
