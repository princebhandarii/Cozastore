import { useSelector } from "react-redux";
import { ResponsiveContainer, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";
import { formatPrice } from "../../utils/formatPrice";

const useColors = () => {
  const dark = useSelector((s) => s.theme.mode) === "dark";
  return dark
    ? { ink: "#f5f5f5", muted: "#a3a3a3", grid: "#2b2b2b", bg: "#111111", palette: ["#f5f5f5", "#a3a3a3", "#6b6b6b", "#3d3d3d", "#d4d4d4"] }
    : { ink: "#0a0a0a", muted: "#6b6b6b", grid: "#e5e5e5", bg: "#ffffff", palette: ["#0a0a0a", "#6b6b6b", "#a3a3a3", "#d4d4d4", "#2b2b2b"] };
};

const shortDate = (d) => new Date(`${d}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
const compact = (n) => (n >= 100000 ? `${(n / 100000).toFixed(1)}L` : n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : String(n));

const Box = ({ title, note, children, empty }) => (
  <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
    <p className="text-sm font-medium">{title}</p>
    {note && <p className="text-xs text-[var(--muted)]">{note}</p>}
    <div className="mt-4 h-64">{empty ? <p className="flex h-full items-center justify-center text-sm text-[var(--muted)]">No data for this period.</p> : children}</div>
  </div>
);

const tooltipStyle = (c) => ({ background: c.bg, border: `1px solid ${c.grid}`, borderRadius: 8, fontSize: 12, color: c.ink });

export default function AnalyticsCharts({ data }) {
  const c = useColors();
  const hasSales = data.totals.orders > 0;
  const pieData = data.paymentMethods.map((m) => ({ name: m.method === "COD" ? "Cash on delivery" : "Online", value: m.orders }));

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Box title="Revenue over time" note="Confirmed orders by confirmation date (IST)" empty={!hasSales}>
        <ResponsiveContainer>
          <AreaChart data={data.daily} margin={{ left: -10, right: 8, top: 4 }}>
            <CartesianGrid stroke={c.grid} vertical={false} />
            <XAxis dataKey="date" tickFormatter={shortDate} stroke={c.muted} fontSize={11} tickLine={false} minTickGap={24} />
            <YAxis tickFormatter={compact} stroke={c.muted} fontSize={11} tickLine={false} axisLine={false} />
            <Tooltip formatter={(v) => [formatPrice(v), "Revenue"]} labelFormatter={shortDate} contentStyle={tooltipStyle(c)} />
            <Area type="monotone" dataKey="revenue" stroke={c.ink} fill={c.ink} fillOpacity={0.08} strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </Box>

      <Box title="Orders over time" note="Confirmed orders per day" empty={!hasSales}>
        <ResponsiveContainer>
          <BarChart data={data.daily} margin={{ left: -20, right: 8, top: 4 }}>
            <CartesianGrid stroke={c.grid} vertical={false} />
            <XAxis dataKey="date" tickFormatter={shortDate} stroke={c.muted} fontSize={11} tickLine={false} minTickGap={24} />
            <YAxis allowDecimals={false} stroke={c.muted} fontSize={11} tickLine={false} axisLine={false} />
            <Tooltip formatter={(v) => [v, "Orders"]} labelFormatter={shortDate} contentStyle={tooltipStyle(c)} cursor={{ fill: c.grid, opacity: 0.4 }} />
            <Bar dataKey="orders" fill={c.ink} radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Box>

      <Box title="Top products" note="Item sales before coupon discounts" empty={data.topProducts.length === 0}>
        <ResponsiveContainer>
          <BarChart data={data.topProducts} layout="vertical" margin={{ left: 10, right: 16 }}>
            <CartesianGrid stroke={c.grid} horizontal={false} />
            <XAxis type="number" tickFormatter={compact} stroke={c.muted} fontSize={11} tickLine={false} />
            <YAxis type="category" dataKey="name" width={110} stroke={c.muted} fontSize={11} tickLine={false} axisLine={false} tickFormatter={(n) => (n.length > 16 ? `${n.slice(0, 15)}…` : n)} />
            <Tooltip formatter={(v, _n, p) => [`${formatPrice(v)} · ${p.payload.units} sold`, "Sales"]} contentStyle={tooltipStyle(c)} cursor={{ fill: c.grid, opacity: 0.4 }} />
            <Bar dataKey="revenue" fill={c.ink} radius={[0, 3, 3, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Box>

      <Box title="Category performance" note="Item sales by category" empty={data.categories.length === 0}>
        <ResponsiveContainer>
          <BarChart data={data.categories} margin={{ left: -10, right: 8 }}>
            <CartesianGrid stroke={c.grid} vertical={false} />
            <XAxis dataKey="name" stroke={c.muted} fontSize={11} tickLine={false} tickFormatter={(n) => (n.length > 12 ? `${n.slice(0, 11)}…` : n)} />
            <YAxis tickFormatter={compact} stroke={c.muted} fontSize={11} tickLine={false} axisLine={false} />
            <Tooltip formatter={(v, _n, p) => [`${formatPrice(v)} · ${p.payload.units} sold`, "Sales"]} contentStyle={tooltipStyle(c)} cursor={{ fill: c.grid, opacity: 0.4 }} />
            <Bar dataKey="revenue" fill={c.muted} radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Box>

      <Box title="Payment methods" note="Share of confirmed orders" empty={pieData.length === 0}>
        <ResponsiveContainer>
          <PieChart>
            <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2} stroke={c.bg}>
              {pieData.map((_, i) => <Cell key={i} fill={c.palette[i % c.palette.length]} />)}
            </Pie>
            <Tooltip formatter={(v, n) => [`${v} orders`, n]} contentStyle={tooltipStyle(c)} />
            <Legend wrapperStyle={{ fontSize: 12, color: c.muted }} />
          </PieChart>
        </ResponsiveContainer>
      </Box>
    </div>
  );
}
