import { useEffect, useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import { Plus, Trash2, Pencil } from "lucide-react";
import {
  listMyAddresses,
  addMyAddress,
  updateMyAddress,
  deleteMyAddress,
  updateMyProfile,
} from "../../services/authService";
import { syncProfile } from "../../store/authSlice";

const emptyAddress = {
  fullName: "",
  phone: "",
  addressLine1: "",
  addressLine2: "",
  landmark: "",
  city: "",
  state: "",
  pincode: "",
  addressType: "Home",
};

export default function Account() {
  const dispatch = useDispatch();
  const { profile } = useSelector((state) => state.auth);
  const [name, setName] = useState(profile?.name || "");
  const [phone, setPhone] = useState(profile?.phone || "");
  const [savingProfile, setSavingProfile] = useState(false);

  const [addresses, setAddresses] = useState([]);
  const [loadingAddresses, setLoadingAddresses] = useState(true);
  const [form, setForm] = useState(emptyAddress);
  const [editingId, setEditingId] = useState(null);
  const [formError, setFormError] = useState("");

  const loadAddresses = async () => {
    setLoadingAddresses(true);
    try {
      const data = await listMyAddresses();
      setAddresses(data);
    } finally {
      setLoadingAddresses(false);
    }
  };

  useEffect(() => {
    loadAddresses();
  }, []);

  const saveProfile = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      await updateMyProfile({ name, phone });
      await dispatch(syncProfile());
    } finally {
      setSavingProfile(false);
    }
  };

  const submitAddress = async (e) => {
    e.preventDefault();
    setFormError("");
    if (!/^[6-9]\d{9}$/.test(form.phone)) {
      setFormError("Enter a valid 10-digit Indian phone number");
      return;
    }
    if (!/^\d{6}$/.test(form.pincode)) {
      setFormError("Enter a valid 6-digit PIN code");
      return;
    }
    try {
      if (editingId) {
        await updateMyAddress(editingId, form);
      } else {
        await addMyAddress(form);
      }
      setForm(emptyAddress);
      setEditingId(null);
      await loadAddresses();
    } catch (err) {
      setFormError(err.message);
    }
  };

  const editAddress = (addr) => {
    setEditingId(addr._id);
    setForm({ ...emptyAddress, ...addr });
  };

  const removeAddress = async (id) => {
    await deleteMyAddress(id);
    await loadAddresses();
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="font-display text-3xl font-semibold">My account</h1>

      <section className="mt-8 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6">
        <h2 className="font-medium">Profile</h2>
        <form onSubmit={saveProfile} className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm font-medium">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Phone</label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Email</label>
            <input
              value={profile?.email || ""}
              disabled
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm opacity-60"
            />
          </div>
          <div className="flex items-end">
            <button
              disabled={savingProfile}
              className="rounded-full bg-ink-950 px-6 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-ink-950"
            >
              {savingProfile ? "Saving..." : "Save profile"}
            </button>
          </div>
        </form>
      </section>

      <section className="mt-8 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6">
        <h2 className="font-medium">Addresses</h2>

        {loadingAddresses ? (
          <div className="mt-4 h-20 rounded-lg skeleton" />
        ) : addresses.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--muted)]">No saved addresses yet.</p>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {addresses.map((addr) => (
              <div key={addr._id} className="rounded-xl border border-[var(--border)] p-4 text-sm">
                <div className="flex items-center justify-between">
                  <span className="rounded-full bg-[var(--bg)] px-2 py-0.5 text-xs">{addr.addressType}</span>
                  <div className="flex gap-2">
                    <button onClick={() => editAddress(addr)} aria-label="Edit">
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => removeAddress(addr._id)} aria-label="Delete">
                      <Trash2 size={14} className="text-[var(--color-danger)]" />
                    </button>
                  </div>
                </div>
                <p className="mt-2 font-medium">{addr.fullName}</p>
                <p className="text-[var(--muted)]">
                  {addr.addressLine1}, {addr.addressLine2 && `${addr.addressLine2}, `}
                  {addr.city}, {addr.state} - {addr.pincode}
                </p>
                <p className="text-[var(--muted)]">{addr.phone}</p>
              </div>
            ))}
          </div>
        )}

        <form onSubmit={submitAddress} className="mt-6 grid gap-3 sm:grid-cols-2">
          {formError && (
            <p className="sm:col-span-2 text-xs text-[var(--color-danger)]">{formError}</p>
          )}
          <input
            placeholder="Full name"
            value={form.fullName}
            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
            className="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm"
          />
          <input
            placeholder="Phone (10 digits)"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            className="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm"
          />
          <input
            placeholder="Address line 1"
            value={form.addressLine1}
            onChange={(e) => setForm({ ...form, addressLine1: e.target.value })}
            className="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm sm:col-span-2"
          />
          <input
            placeholder="Address line 2 (optional)"
            value={form.addressLine2}
            onChange={(e) => setForm({ ...form, addressLine2: e.target.value })}
            className="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm sm:col-span-2"
          />
          <input
            placeholder="Landmark (optional)"
            value={form.landmark}
            onChange={(e) => setForm({ ...form, landmark: e.target.value })}
            className="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm sm:col-span-2"
          />
          <input
            placeholder="City"
            value={form.city}
            onChange={(e) => setForm({ ...form, city: e.target.value })}
            className="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm"
          />
          <input
            placeholder="State"
            value={form.state}
            onChange={(e) => setForm({ ...form, state: e.target.value })}
            className="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm"
          />
          <input
            placeholder="PIN code (6 digits)"
            value={form.pincode}
            onChange={(e) => setForm({ ...form, pincode: e.target.value })}
            className="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm"
          />
          <select
            value={form.addressType}
            onChange={(e) => setForm({ ...form, addressType: e.target.value })}
            className="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm"
          >
            <option>Home</option>
            <option>Work</option>
            <option>Other</option>
          </select>
          <button className="flex items-center justify-center gap-2 rounded-full bg-ink-950 px-6 py-2 text-sm font-medium text-white dark:bg-white dark:text-ink-950 sm:col-span-2">
            <Plus size={14} /> {editingId ? "Update address" : "Add address"}
          </button>
        </form>
      </section>
    </div>
  );
}
