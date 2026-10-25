import SiteSettings from "../models/SiteSettings.js";

// Always returns the (auto-created) single settings document.
export const getSettings = () =>
  SiteSettings.findOneAndUpdate({ key: "main" }, { $setOnInsert: { key: "main" } }, { upsert: true, returnDocument: "after" });
