import { useEffect, useState } from "react";
import { getAdminSettingsApi, updateCodSettingsApi, updateOrderRulesApi, updateReturnRulesApi, updateShippingSettingsApi } from "../../services/adminService";
import AdminPage from "../../components/admin/AdminPage";
import { input } from "../../components/admin/ui";

function Section({ title, children }) {
  return <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5"><p className="mb-3 text-sm font-medium">{title}</p>{children}</div>;
}
const Field = ({ label, children }) => <label className="block text-xs text-[var(--muted)]">{label}<div className="mt-1">{children}</div></label>;
const Toggle = ({ label, checked, onChange }) => <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} /> {label}</label>;

export default function Settings() {
  const [s, setS] = useState(null);
  const [msg, setMsg] = useState("");

  useEffect(() => { getAdminSettingsApi().then(setS); }, []);
  if (!s) return <div className="grid gap-4 sm:grid-cols-2">{Array.from({ length: 4 }, (_, i) => <div key={i} className="h-40 rounded-2xl skeleton" />)}</div>;

  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(""), 2000); };
  const save = async (section, fn, patch) => {
    try { const updated = await fn(patch); setS((prev) => ({ ...prev, [section]: updated[section] ?? updated })); flash("Saved"); }
    catch (e) { flash(e.message); }
  };

  return (
    <AdminPage title="Settings" subtitle="Changes apply to new orders only." actions={msg && <span className="text-xs text-[var(--muted)]">{msg}</span>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Section title="Cash on delivery">
          <div className="space-y-2 text-sm">
            <Toggle label="Enabled" checked={s.cod.enabled} onChange={(v) => save("cod", () => updateCodSettingsApi({ enabled: v }), null)} />
            <div className="grid grid-cols-2 gap-2">
              <Field label="Min order (₹)"><input className={input} type="number" defaultValue={s.cod.minOrderAmount} onBlur={(e) => save("cod", () => updateCodSettingsApi({ minOrderAmount: Number(e.target.value) }), null)} /></Field>
              <Field label="Max order (₹, 0=none)"><input className={input} type="number" defaultValue={s.cod.maxOrderAmount} onBlur={(e) => save("cod", () => updateCodSettingsApi({ maxOrderAmount: Number(e.target.value) }), null)} /></Field>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Token type"><select className={input} defaultValue={s.cod.tokenType} onChange={(e) => save("cod", () => updateCodSettingsApi({ tokenType: e.target.value }), null)}><option value="fixed">Fixed</option><option value="percentage">Percentage</option></select></Field>
              <Field label="Token value"><input className={input} type="number" defaultValue={s.cod.tokenValue} onBlur={(e) => save("cod", () => updateCodSettingsApi({ tokenValue: Number(e.target.value) }), null)} /></Field>
            </div>
            <Toggle label="Require phone OTP" checked={s.cod.otpRequired} onChange={(v) => save("cod", () => updateCodSettingsApi({ otpRequired: v }), null)} />
            <p className="text-xs text-[var(--muted)]">Full COD controls, including token cancellation policy, are on the COD page.</p>
          </div>
        </Section>

        <Section title="Shipping">
          <div className="space-y-2 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <Field label="Free shipping above (₹, blank = .env default)"><input className={input} type="number" defaultValue={s.shipping.freeThreshold ?? ""} onBlur={(e) => save("shipping", () => updateShippingSettingsApi({ freeThreshold: e.target.value === "" ? null : Number(e.target.value) }), null)} /></Field>
              <Field label="Flat shipping charge (₹, blank = .env default)"><input className={input} type="number" defaultValue={s.shipping.flatCharge ?? ""} onBlur={(e) => save("shipping", () => updateShippingSettingsApi({ flatCharge: e.target.value === "" ? null : Number(e.target.value) }), null)} /></Field>
            </div>
            <p className="text-xs text-[var(--muted)]">Blank fields fall back to FREE_SHIPPING_THRESHOLD / FLAT_SHIPPING_CHARGE from server/.env.</p>
          </div>
        </Section>

        <Section title="Cancellation rules">
          <div className="space-y-2 text-sm">
            <Toggle label="Customers can cancel confirmed orders" checked={s.orders.cancelWhenConfirmed} onChange={(v) => save("orders", () => updateOrderRulesApi({ cancelWhenConfirmed: v }), null)} />
            <Toggle label="Customers can cancel orders being processed" checked={s.orders.cancelWhenProcessing} onChange={(v) => save("orders", () => updateOrderRulesApi({ cancelWhenProcessing: v }), null)} />
          </div>
        </Section>

        <Section title="Returns">
          <div className="space-y-2 text-sm">
            <Toggle label="Accept returns" checked={s.returns.enabled} onChange={(v) => save("returns", () => updateReturnRulesApi({ enabled: v }), null)} />
            <Field label="Return window (days after delivery)"><input className={input} type="number" min="1" max="60" defaultValue={s.returns.windowDays} onBlur={(e) => save("returns", () => updateReturnRulesApi({ windowDays: Number(e.target.value) }), null)} /></Field>
          </div>
        </Section>

        <Section title="Store details (invoices)">
          <p className="text-sm text-[var(--muted)]">Set via <code>server/.env</code>: STORE_NAME, STORE_ADDRESS, STORE_STATE, STORE_GSTIN, STORE_EMAIL, STORE_PHONE, GST_RATE_PERCENT. Restart the server after changing these.</p>
        </Section>
      </div>
    </AdminPage>
  );
}
