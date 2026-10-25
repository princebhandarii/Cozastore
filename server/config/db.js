import dns from "dns";
import mongoose from "mongoose";
import { env } from "./env.js";

// Some networks (college/office WiFi, certain ISPs, VPNs) can't resolve the
// SRV record behind a `mongodb+srv://` Atlas URL and fail with
// "querySrv EBADRESP". To work around that, development uses public DNS
// resolvers for this process only. Override with DNS_SERVERS="1.1.1.1,8.8.4.4",
// or set DNS_SERVERS=system to keep the machine's own resolver. Production
// always uses the host's resolver unless DNS_SERVERS is set explicitly.
const configureDns = () => {
  const setting = process.env.DNS_SERVERS?.trim();
  if (setting === "system") return;
  const servers = setting ? setting.split(",").map((s) => s.trim()).filter(Boolean) : env.nodeEnv === "development" ? ["8.8.8.8", "1.1.1.1"] : [];
  if (servers.length) dns.setServers(servers);
};

export const connectDB = async () => {
  configureDns();
  mongoose.set("strictQuery", true);

  try {
    await mongoose.connect(env.mongodbUri);
    // eslint-disable-next-line no-console
    console.log(`MongoDB connected: ${mongoose.connection.host}`);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("MongoDB connection failed:", err.message);
    process.exit(1);
  }

  mongoose.connection.on("disconnected", () => {
    // eslint-disable-next-line no-console
    console.warn("MongoDB disconnected");
  });
};
