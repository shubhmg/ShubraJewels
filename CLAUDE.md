# CLAUDE.md — Shubra Jewels

> **RULE: update this file after every change** (new page, model, route, pattern, or architecture shift).

## What this is

A royal **Rajasthani jhumka** e-commerce store — brand slogan **हर झुमका एक कहानी** ("every jhumka tells a story"). **Everything on the storefront is editable from the admin panel** (products, prices, categories, royal collections, offer banners, homepage videos, reviews, customer gallery, Hindi taglines, brand slogan, WhatsApp number, and the colour theme). Includes self-hosted **visitor analytics**.

## Stack

- **Frontend:** Vite + React 18 + Tailwind + Zustand + framer-motion + lucide-react + recharts. Dev port **5273**.
- **Backend:** Node + Express + Mongoose (ESM), `server/`. Port **4200**. MongoDB **Atlas** (same cluster as Natraj2), database **`shubra`**.
- **Ordering:** cart + checkout saves an Order (NO payment gateway yet — orders only) + a WhatsApp order button everywhere.
- **Media:** admin drag-drop file upload → `server/uploads/` (served at `/uploads`).

## Run

```bash
# API (from server/)
cd server && npm install && npm run seed   # seed content + admin (FORCE=1 to wipe & reseed)
npm run dev                                # nodemon-style --watch, :4200

# Web (from repo root)
npm install && npm run dev                 # :5273, proxies /api + /uploads -> :4200
npm run build                              # prod build to dist/ (Express serves it in prod)
```

Admin seed creds (from `server/.env`): `admin@shubrajewels.in` / `shubra@admin`. WhatsApp number seeded as a placeholder — change in admin Settings.

## Backend (`server/src/`)

- `config/env.js` (loads `server/.env`), `config/db.js` (Atlas `shubra`).
- `middleware/`: `auth.js` (`requireAdmin` JWT Bearer), `optionalAuth.js` (attaches `req.admin` if token, never rejects — lets one GET serve public active-only vs admin `?all=1`), `validate.js` (Joi, **stripUnknown**), `upload.js` (multer 2.x → `uploads/`), `errorHandler.js`.
- `utils/crudFactory.js` — builds a REST router (list/get/create/update/delete + `/reorder`) from a Model + Joi schemas. Public GET returns `publicFilter` (default `{isActive:true}`); admin `?all=1` returns everything. Used by category, collection, banner, video, review (publicFilter `{isApproved:true}`), gallery.
- **Modules** (`modules/<name>/`): `auth` (AdminUser + login/me/change-password), `setting` (singleton, `getSettings()`), `category`, `collection` (royal), `product` (custom routes: filter by `category`/`collection`/`under599`/`onSale`/`search`, id-or-slug detail), `banner`, `video`, `review`, `gallery`, `order` (public POST re-reads prices from DB, admin list/patch; orderNo `SJ-YYYY-#####`), `analytics` (`visit.model` + `POST /track` public + `GET /summary` admin), `upload`.
- `app.js` wires all routes under `/api/*`, serves `/uploads`, and in production serves `dist/`. `scripts/seed.js` seeds curated on-brand content.
- **Model note:** Product uses `isNewArrival` (NOT `isNew` — reserved Mongoose word).

## Data models (all admin-editable)

Setting (singleton: slogan, taglines, whatsappNumber, freeShippingCity, socials incl. instagramUrl, **theme{maroon,maroonDark,gold,goldLight,beige,cream,ink}**), Category, Collection (royal: accentColor, tagline), Product (name, hindiName, **story**, price, mrp, categoryId, collectionIds[], images[], video, material, weight, stock, badges, rating), Banner (placement topStrip/hero/offer), Video (isHero), Review (isApproved/isFeatured), GalleryItem (image/caption/customerName plus optional Instagram `link` and linked `productId`), Order, Visit.

## Frontend (`src/`)

- **Data layer:** `lib/api.js` (fetch wrapper + token in localStorage `sj-admin-token`; `normalizeProduct` adds `id`=`_id` + `originalPrice`=`mrp` so legacy mock-shaped components keep working). `hooks/useApi.js` (`useFetch` + `useProducts/useCategories/useCollections/useBanners/useVideos/useReviews/useGallery/useProduct`). `store/authStore.js` (admin login).
- **Theme:** `lib/SettingsProvider.jsx` wraps `<App/>` in `main.jsx`. Fetches `/settings`, injects `theme` colours as CSS vars (`--maroon`, `--gold`, `--beige`, `--cream`, `--ink`, …) on `:root`. `useSettings()` hook; `whatsappLink(settings, msg)` helper. **This is why the palette is admin-editable.**
- **Analytics:** `lib/session.js` (`trackPageView` via `navigator.sendBeacon`, random `sessionId` in localStorage). Fired on every route change by `<Analytics/>` in `App.jsx` StorefrontLayout.
- **Design system:** Tailwind `brand.*` colours map to the CSS vars; fonts `font-display` (**Fraunces**, modern luxe serif), `font-sans` (Inter), `font-hindi`/`font-mukta` (**Mukta**). Royal utility classes in `index.css`: `.btn-maroon`, `.btn-gold`, `.btn-whatsapp`, `.btn-outline-gold`, `.eyebrow`, `.temple-frame`, `.mehendi-divider`, `.mandala-bg`, `.royal-gold-text`.
- **Motion:** `components/motion/Motion.jsx` — `Reveal`/`Stagger`/`StaggerItem` (framer-motion in-view fade+rise, `once`), `Tilt` (pointer 3D perspective, rAF-throttled, no-op on touch), `Magnetic` (button pulls toward cursor, no-op on touch). Applied across `Home` (staggered hero lines + magnetic CTAs, tilt on category/collection/gallery tiles, reveals on every section) and `Products` grid; `ProductCard` image has built-in `Tilt`. `components/motion/GoldDust.jsx` (canvas particle field) still exists but the hero now uses the 3D jewel instead.
- **3D hero (Three.js):** `components/motion/HeroJewel.jsx` — a stylized gold **jhumka** built from primitives (LatheGeometry dome + hook torus + a skirt of sphere "bells"), gold `meshStandardMaterial`, `Float` bob + slow spin + pointer parallax, drei `Environment`+`Lightformer` for **procedural** reflections (no HDRI download), `Sparkles` for gold glints. Deps: `three@0.160`, `@react-three/fiber@8`, `@react-three/drei@9`. **Lazy-loaded** in `Home.jsx` (`React.lazy` → its own ~240KB-gzip chunk, only on the homepage). Render loop pauses when the hero scrolls off-screen (IntersectionObserver → `frameloop`), and honours `prefers-reduced-motion`. Colours come from `settings.theme.gold`/`goldLight` (admin-editable). Hero layout is now flex-col: 3D jewel on top, text below (readable, no overlap). The old hero video shows in the "Jhumkas in Motion" section instead.
- **Scroll performance:** `.section` uses `content-visibility:auto` + `contain-intrinsic-size:auto 700px`; hero `<video>` pauses off-screen; navbar uses `backdrop-blur-md` + `transform-gpu`; grid images use `loading="lazy" decoding="async"`; no global `scroll-behavior:smooth`.
- **Decor components:** `components/decor/Decor.jsx` — `Mandala`, `MehendiDivider`, `TempleFrame`, `Motif`. `components/ui/WhatsAppButton.jsx`, `components/ui/SectionHeading.jsx`.
- **Pages (all storefront pages are API-driven + royal):**
  - `Home.jsx` — hero video + slogan, offer strip, categories, featured jhumkas, story spotlight, royal collections, under ₹599, videos, reviews, customer gallery, slogan band.
  - `Products.jsx` — reads `?category=`/`?collection=`/`?under599=1` from URL, dynamic filter chips from categories/collections, client-side sort, royal header.
  - `ProductDetail.jsx` — `useProduct(id)` (id or slug), story-forward block, material/weight/sku, add-to-cart + `WhatsAppButton`, related by category. Gallery slide = `object-contain` foreground (whole image, never cropped) over a blurred `object-cover scale-110 blur-2xl` copy of the same photo (ambient fill) so non-square images show fully instead of being center-cropped or leaving flat bars.
  - `Collections.jsx` — alternating royal-collection features + new arrivals.
  - `Wishlist.jsx`, `About.jsx` (settings brand story), `Contact.jsx` (WhatsApp-first composer + settings contact/socials).
  - `Navbar` (brand/logo from settings) + `Footer` (settings-driven: socials, contact, category links) + `SearchModal` (live products).
  - `ProductCard` redesigned + tolerant of both API and legacy mock shapes.
  - Note: no separate announcement top-strip (offer banners on Home cover it; avoided to not break page `pt-*` offsets under the fixed navbar).

## Status / roadmap

- ✅ **Phase 1-2:** backend foundation + all content models/APIs + seed (verified against Atlas).
- ✅ **Phase 3:** full storefront rewired to API + royal redesign (Home, Products, ProductDetail, Collections, Wishlist, About, Contact, Navbar, Footer, SearchModal, ProductCard). Build passes; dev servers verified.
- ✅ **Phase 4:** `Checkout.jsx` → `POST /api/orders` (no payment) + WhatsApp order (records order, channel `whatsapp`, then opens wa.me) + success screen with order no.
- ✅ **Phase 5:** Admin panel — login gate (`AdminLayout` redirects to `/admin/login` when no token; `authStore` JWT in localStorage `sj-admin-token`). Reusable building blocks in `components/admin/`: `MediaUploader`/`MultiImageUploader` (drag-drop → `/api/upload`; `MultiImageUploader` queues each picked image through `ImageCropper.jsx` — a fixed-ratio crop modal built on **`react-easy-crop`**, default `aspect={1}` square — before uploading, so product photos tile uniformly in listings; crop → canvas → JPEG blob → `api.upload`; server re-encodes to webp ≤1800px via `imageOptimizer.js`. `react-easy-crop`'s CSS must be imported in `ImageCropper.jsx` — the lib does not self-inject styles), `AdminUI.jsx` (`Modal`, `Field` renderer for text/textarea/number/toggle/select/multiselect/color/tags/lines/image/video, `Btn`, `Toggle`), `ResourceManager.jsx` (generic CRUD list+modal). Editors: `Products` (rich, dynamic category/collection options + multi-image), `Categories`/`CollectionsAdmin`/`Banners`/`Videos`/`Reviews`/`Gallery` (thin `ResourceManager` configs), `Orders` (list + status dropdown), `Settings` (brand/slogan/taglines/WhatsApp/socials + **live theme colour pickers**; on save calls `useSettingsCtx().refresh()` to retint the site immediately). Routes wired in `App.jsx`; admin nav in `AdminLayout`.
- ✅ **Phase 6:** `admin/Dashboard.jsx` — KPI cards (views, unique visitors, orders, revenue), visitors area chart (recharts), top pages, recent orders, off `GET /api/analytics/summary?days=`.

**All 6 phases complete.** Old admin pages (`Inventory.jsx`, `Customers.jsx`, `Reports.jsx`, `ProductForm.jsx`) are no longer routed and can be deleted. `src/data/mockData.js` is now only used by the one-time server seed — safe to remove from the web app.

## Later additions

- **Homepage = block builder:** `Setting.homepage` = `{ hero:{ subheading, ctaLabel, ctaLink, showWhatsapp, background:'jewel'|'image'|'video', mediaUrl }, blocks:[{ id, type, enabled, config }] }`. `blocks` is a **Mixed** array (config shape varies by type) — order = render order, multiples allowed. Block types (`src/lib/homepageDefault.js` `BLOCK_TYPES`): `productGrid` (config: heading + `source` featured/new/under599/onSale/category/collection/all + `categoryId`/`collectionId` + `limit` + `dark`), `categories`, `collections`, `banners`, `story`, `videos`, `reviews`, `gallery`, `image` (url/link/caption), `text` (eyebrow/title/hindi/body/dark). `Home.jsx` iterates `homepage.blocks` → `renderBlock(b)` switch on `b.type` (generic `ProductGridBlock`/`ImageBlock`/`TextBlock` + the reused section components taking `h={config}`). Admin: `pages/admin/Homepage.jsx` — hero editor (incl. background image/video upload) + **add/reorder/toggle/remove/configure** blocks (per-type config forms; `+ Add block` menu). `DEFAULT_HOMEPAGE` mirrored in `server/.../setting.model.js` (Mixed `blocks` default) and `src/lib/homepageDefault.js`. `PATCH /settings { homepage }` replaces the object + `markModified`. `SettingsProvider` falls back to default blocks when the stored doc has none. **NOTE:** old `homepage.sections` shape is dead — superseded by `blocks`.
- **Admin seed/clear:** `modules/admin/{seed.service.js,admin.routes.js}` — `POST /api/admin/seed` (fills empty collections; `?force=1` wipes+reseeds) and `POST /api/admin/clear` (deletes all content, keeps orders/settings/admin). Seed data + logic extracted from the CLI script into `seed.service.js` (shared). Buttons on admin Dashboard (`DemoDataCard`). CLI: `SKIP_ADMIN=1` seeds content without resetting the admin password.
- **Dark mode removed:** light-only. `main.jsx` force-removes `dark`; theme toggles removed from Navbar/AdminLayout. (`dark:` classes remain in markup but never activate; `themeStore.js` unused.)
- **Mobile header:** Navbar rewritten responsive (smaller brand/targets on mobile, closes on route change, wishlist moved into mobile menu).
- **Custom dropdown:** `components/ui/Dropdown.jsx` (styled select replacement) used for the Products sort (replaced the native `<select>`).
- **Admin orders:** status filter tabs (all/pending/confirmed/shipped/delivered/cancelled with counts) on `pages/admin/Orders.jsx`.

- **Order confirmation email:** `utils/mailer.js` — nodemailer + Brevo SMTP. Sends a royal branded HTML email to the customer's email on order placement (best-effort, like Telegram). Config: `BREVO_SMTP_HOST/PORT/USER/PASS` + `EMAIL_FROM` + `EMAIL_FROM_NAME` in `server/.env`. Falls back silently if no email provided or SMTP not configured.

- **Delhivery integration REMOVED (Jul 2026):** direct Delhivery API support was built, then removed — the account was B2B-only (no B2C token) and Shiprocket books Delhivery couriers anyway. All shipping goes through Shiprocket or a manual tracking note. Do not reintroduce `utils/delhivery.js`.

- **Shiprocket courier integration:** `server/src/utils/shiprocket.js` — client for the Shiprocket aggregator (base `apiv2.shiprocket.in/v1/external`). Auth is a **login API** (`POST /auth/login {email,password}` → JWT valid ~10 days) — `ensureToken(settingDoc)` caches the JWT on `Setting.shiprocket.token`+`tokenExpiry` and re-logs in when expired (persists via the passed Mongoose doc). Booking is a 3-step dance: `POST /orders/create/adhoc` → `POST /courier/assign/awb` (Shiprocket picks the recommended courier, or pass `courierId` from the serviceability list to force one — sent as `courier_id`) → `POST /courier/generate/label` (+ `generate/pickup`). `checkServiceability` returns couriers as `{ id (courier_company_id), name, rate, cod, etd, etdDays, rating, recommended }` sorted by rate. Also serviceability (`GET /courier/serviceability/`), track (`GET /courier/track/awb/:awb`), cancel (`POST /orders/cancel {ids:[srOrderId]}`).
  - **Config (SECRET):** `Setting.shiprocket` = `{ enabled, email (secret), password (secret), token+tokenExpiry (cached JWT, secret), policy, pickupLocation (nickname, exact), pickupPin (for serviceability), defaultWeightKg (×qty), length/breadth/height (cm) }`. Stripped from public `GET /settings` + `PATCH` response like `notifications`. `PATCH /settings` deep-merges and **clears the cached JWT if email/password change**. Test: `POST /settings/test-shiprocket` (logs in).
  - Shiprocket uses **kg**. `orderPaymentMode(order)` = Prepaid if paid or non-COD method, else COD; COD collect = `total − advancePaid`. `policy` (`shouldAutoShip`): all / cod / prepaid / manual. `shiprocket.autoPickup` (default **false**) gates the `generate/pickup` call so test bookings don't summon a courier; turn ON for live orders.
  - **Status webhook:** `POST /api/orders/courier-webhook` (public, verified against `shiprocket.webhookToken` via the `x-api-key` header — no token configured = webhook disabled/401). Finds the order by `shipment.waybill`, updates `shipment.status/statusDetail/lastSyncedAt`; on a Delivered status (excluding "RTO Delivered") auto-advances shipped→delivered + COD→paid + `reconcileOrderStock`. Unknown AWBs are ACKed with 200 (no retries). Settings UI shows the webhook URL to copy + token field + Generate button; configure in Shiprocket → Settings → API → Webhooks.
  - **Re-book safety:** couriers key on the order reference and reject a re-used one even after cancel ("AWB already assigned"). `Order.shipmentAttempts` counts bookings (lives outside `shipment` so "Cancel & reset" preserves it); `bookWithRetry()` in order.routes sends `{orderNo}` first, then retries with `{orderNo}-R{n}` on a duplicate-id error. Both `createShipment` clients accept an `orderRef` override.

- **Shared courier plumbing** (`Order.shipment` + order routes):
  - `Order.shipment` = `{ provider: manual|shiprocket, waybill (AWB), shipmentId (SR label/pickup), srOrderId (SR cancel), courierName, trackingUrl (provider-specific), mode, codAmount, weightGrams, status, statusDetail, labelUrl, bookedAt, lastSyncedAt }`.
  - **Bulk ship:** `POST /orders/bulk-ship {ids[<=50]}` books sequentially with default weights (skipPickup per booking), then `shiprocket.schedulePickup(ids)` clubs ONE pickup request when auto-pickup is on; returns `{booked[], failed[], pickupScheduled}` (failures stay in To Ship). Frontend: checkboxes on To Ship rows (when Shiprocket enabled) -> floating bulk bar (count / All on page / Clear / Book N) -> `BulkShipSheet` (review with per-order default weight -> results view). Selection clears on filter/search/page change.
  - Booking route `POST /orders/:id/ship-shiprocket {weight? kg, courierId? (force a courier from the serviceability list)}` funnels through `applyBooking()` (stamps shipment, marks Shipped, auto-fills `tracking.message` + track link, sends shipped email) with `bookWithRetry()` (`{orderNo}-R{n}` on duplicate-id errors, counter in `Order.shipmentAttempts`). `sync-shipment` refreshes live status (auto-advances to delivered); `cancel-shipment` accepts `{revert}` — `revert:true` (one-click "Cancel & reset") wipes the shipment + tracking and steps a Shipped order back to Confirmed for re-booking; `GET /:id/label` fetches the label PDF link. Serviceability probe: `GET /orders/shiprocket/serviceability?pin=&weight=&cod=` (needs `shiprocket.pickupPin`).
  - **`pages/admin/Orders.jsx` `ShipModal`** (bottom sheet on mobile / centered card on desktop) has **Shiprocket** + **Manual note** tabs. The generic **Shipping Routing** setting (`Setting.shippingRouting`, top-level; falls back to legacy `shiprocket.policy`) RECOMMENDS a tab per order — preselected + tagged "★ Recommended": `all` → Shiprocket always; `cod` → Shiprocket for COD, manual for prepaid; `prepaid` → the reverse; `manual` → no recommendation (manual tab first). Admin can always switch per order. Settings UI = radio-card grid in its own "Shipping Routing" section (NOT inside the Shiprocket card). The Shiprocket tab shows a kg weight field + a **courier picker**: full serviceability list with per-courier freight rate + ETA ("Auto — Shiprocket picks" is the default; Shiprocket's own pick is tagged "★ SR pick"); rates re-quote (600ms debounce) when the weight changes, and the Book button names the chosen courier + rate; incomplete setup shows an amber "finish setup" hint instead of hiding. Order detail drawer shows one **courier card** (courierName, AWB link via `shipment.trackingUrl`, live status, COD collect, Track/Label/Sync/Cancel-AWB). Orders page loads `/settings/admin` once into `srCfg` (enabled/policy/ready). `Field` has a `password` type (`components/admin/AdminUI.jsx`).

## Remaining (not code — go-live)
- Set real WhatsApp number + brand/contact/socials in `/admin/settings` (`instagramUrl` powers the footer handle and gallery wall label).
- Replace seed placeholder images/videos with real uploads (admin drag-drop).
- Change admin password (seeded `shubra@admin`) via `POST /api/auth/change-password` (or reseed with new `.env`).
- Deploy: build web (`npm run build`), run `server/` with `NODE_ENV=production` (serves `dist/` + `/uploads`) under PM2 on the Natraj2 box; nginx vhost + domain; ensure `server/uploads/` persists.
