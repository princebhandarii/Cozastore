# Deployment — Coza Store

This walks through taking the app from `localhost` to a public URL:
**MongoDB Atlas** (database) → **Render** (API) → **Vercel** (storefront),
with Firebase, Cloudinary, Razorpay and the optional Phase 9 integrations
pointed at production.

Do this after everything already works locally (see the main `README.md`).
Deploying broken local config just moves the debugging online.

---

## 1. MongoDB Atlas (production cluster)

If you're reusing your development cluster, skip to step 2 — one Atlas
cluster can hold multiple databases (e.g. `cozastore-dev`, `cozastore-prod`).

1. Atlas → **Network Access** → add `0.0.0.0/0` (allow from anywhere), since
   Render's outbound IPs aren't static on the free/starter tiers. If you're on
   a plan with static IPs, restrict to those instead.
2. Atlas → **Database Access** → create a production-only database user with
   a strong, generated password (don't reuse the dev user).
3. Copy the connection string; you'll set it as `MONGODB_URI` in step 3.
4. **Transactions require a replica set** — any real Atlas cluster (including
   the free M0 tier) already is one. A plain standalone `mongod` is not.

## 2. Firebase (production settings)

1. Firebase Console → **Authentication → Settings → Authorized domains** →
   add your Vercel domain (e.g. `cozastore.vercel.app`) and any custom domain.
   Without this, sign-in silently fails on the deployed site.
2. You can reuse the same Firebase project for dev and prod, or create a
   second project for production — either works; just make sure the
   `client/.env` values (web config) and `server/.env` values (service
   account) come from the **same** project as each other.

## 3. Backend → Render

1. Push this repo to GitHub/GitLab.
2. Render → **New → Web Service** → connect the repo → set:
   - **Root directory:** `server`
   - **Build command:** `npm install`
   - **Start command:** `npm start`
   - **Health check path:** `/api/health`
3. Add every variable from `server/.env.example` under **Environment**,
   filled with production values:
   - `NODE_ENV=production`
   - `CLIENT_URL` — your Vercel URL (set this *after* step 4, then redeploy)
   - `MONGODB_URI` — from step 1
   - `FIREBASE_PROJECT_ID` / `FIREBASE_CLIENT_EMAIL` / `FIREBASE_PRIVATE_KEY`
     — from a **production** service-account key (Firebase Console → Project
     settings → Service accounts). Paste the private key with literal `\n`
     line breaks, wrapped in quotes, exactly as in `.env.example`.
   - `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET`
   - `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` — switch to **live** keys only
     once you've tested the full flow in test mode (see step 6)
   - `RAZORPAY_WEBHOOK_SECRET` — set after step 6
   - `OTP_SECRET` — a long random string (e.g. `openssl rand -hex 32`);
     required in production, unlike in dev
   - `SMS_PROVIDER` — leave `console` only if you accept that COD OTPs won't
     actually be delivered (the console adapter refuses to run when
     `NODE_ENV=production` anyway) — set up a real provider first if you use
     OTP-gated COD in production
   - `EMAIL_PROVIDER=smtp` + `EMAIL_HOST/PORT/USER/PASSWORD/FROM` — the
     console adapter also refuses to run in production
   - `STORE_NAME` / `STORE_ADDRESS` / `STORE_STATE` / `STORE_GSTIN` /
     `STORE_EMAIL` / `STORE_PHONE` / `GST_RATE_PERCENT` — for invoices
   - `SHIPPING_PROVIDER=pincode-lookup` (default) or `shiprocket` +
     `SHIPROCKET_*` if you've set up a real courier account
4. Deploy. Confirm `https://<your-render-app>.onrender.com/api/health`
   returns `{"success":true}`.
5. Run the seed script once against production **only if you actually want
   demo data in production** (most people don't):
   `npm run seed` locally with `MONGODB_URI` temporarily pointed at prod, or
   via Render's shell. Then promote yourself:
   `npm run make-admin -- you@example.com` (same way, after signing in once
   on the deployed site).

## 4. Frontend → Vercel

1. Vercel → **New Project** → import the repo → set:
   - **Root directory:** `client`
   - **Framework preset:** Vite
   - **Build command:** `npm run build` (default)
   - **Output directory:** `dist` (default)
2. Add every variable from `client/.env.example`:
   - `VITE_API_BASE_URL` — your Render API URL, e.g.
     `https://cozastore-api.onrender.com/api` (note: **not** `/api` alone
     like in local dev, since there's no Vite proxy in production)
   - `VITE_FIREBASE_*` — the same Firebase web-app config as `client/.env`
3. Deploy. Take the resulting URL back to step 3.2 (`CLIENT_URL`) and Firebase
   (authorized domains), then redeploy the backend so CORS and auth accept it.

## 5. Configure CORS and production URLs

- `server/.env`'s `CLIENT_URL` must exactly match the Vercel URL (scheme +
  host, no trailing slash) — the backend only allows that one origin.
- If you add a custom domain to either side, update the corresponding env var
  and redeploy that service.

## 6. Razorpay — go live

1. Test the entire flow first in Razorpay **test mode** against the deployed
   site (test card numbers: https://razorpay.com/docs/payments/payments/test-card-details/).
2. Razorpay Dashboard → switch to **Live mode** → generate live API keys →
   update `RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET` on Render.
3. Settings → **Payment capture** → confirm auto-capture is on (otherwise
   `payment.captured` never fires and orders never confirm).
4. Settings → **Webhooks** → add
   `https://<your-render-app>.onrender.com/api/payments/webhook`, pick a
   secret, subscribe to `payment.captured`, `payment.failed`, `order.paid`,
   `refund.processed`, `refund.failed`, then set that same secret as
   `RAZORPAY_WEBHOOK_SECRET` on Render.
5. Place one real low-value order end-to-end before announcing launch.

## 7. Shiprocket webhook (optional, only if `SHIPPING_PROVIDER=shiprocket`)

Shiprocket dashboard → Settings → **Webhooks** → point it at
`https://<your-render-app>.onrender.com/api/shipping/webhook`, and set the
same token there and as `SHIPROCKET_WEBHOOK_TOKEN` on Render.

## 8. Post-deploy checklist

- [ ] `/api/health` returns 200
- [ ] Sign up / sign in works on the deployed frontend (Firebase authorized domain set)
- [ ] A test product loads with images (Cloudinary URLs resolve)
- [ ] A test checkout completes and the order reaches `CONFIRMED`
- [ ] The Razorpay webhook fires (check its dashboard's webhook log)
- [ ] Order/COD/return emails arrive (or print to Render's logs if still on
      the console adapter — confirm that's intentional)
- [ ] `/admin` is reachable only after `make-admin`, and unreachable for a
      plain customer account

## Notes on the free/starter tiers

- **Render's free tier sleeps** after inactivity; the first request after a
  while will be slow (cold start) — fine for a demo, not for a real store.
- **MongoDB Atlas M0** is rate- and storage-limited; fine for demo traffic.
- None of this is required to run the app — everything above is additive to
  local development, which continues to work exactly as described in the main
  `README.md`.
