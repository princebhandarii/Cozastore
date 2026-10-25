import { env } from "../../config/env.js";

// Minimal inline-CSS wrapper so the templates below only supply the body content.
// Inline styles are used throughout because most email clients strip <style> blocks.
export const wrapEmail = ({ preheader = "", title, bodyHtml }) => `
<!doctype html>
<html>
  <head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>${title}</title></head>
  <body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#0a0a0a;">
    <span style="display:none;font-size:1px;color:#f5f5f5;">${preheader}</span>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:24px 0;">
      <tr><td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;">
          <tr><td style="padding:28px 32px;border-bottom:1px solid #eee;">
            <span style="font-size:20px;font-weight:700;letter-spacing:-0.02em;">${env.store.name}</span>
          </td></tr>
          <tr><td style="padding:32px;">${bodyHtml}</td></tr>
          <tr><td style="padding:20px 32px;border-top:1px solid #eee;font-size:12px;color:#888;">
            ${env.store.name}${env.store.address ? ` · ${env.store.address}` : ""}<br />
            ${[env.store.email, env.store.phone].filter(Boolean).join(" · ")}
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;

export const button = (href, label) =>
  `<a href="${href}" style="display:inline-block;background:#0a0a0a;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:999px;font-size:14px;font-weight:500;">${label}</a>`;

export const money = (n) => `₹${Number(n).toLocaleString("en-IN")}`;
