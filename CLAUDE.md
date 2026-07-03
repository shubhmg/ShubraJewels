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

Setting (singleton: slogan, taglines, whatsappNumber, freeShippingCity, socials, **theme{maroon,maroonDark,gold,goldLight,beige,cream,ink}**), Category, Collection (royal: accentColor, tagline), Product (name, hindiName, **story**, price, mrp, categoryId, collectionIds[], images[], video, material, weight, stock, badges, rating), Banner (placement topStrip/hero/offer), Video (isHero), Review (isApproved/isFeatured), GalleryItem, Order, Visit.

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
  - `ProductDetail.jsx` — `useProduct(id)` (id or slug), story-forward block, material/weight/sku, add-to-cart + `WhatsAppButton`, related by category.
  - `Collections.jsx` — alternating royal-collection features + new arrivals.
  - `Wishlist.jsx`, `About.jsx` (settings brand story), `Contact.jsx` (WhatsApp-first composer + settings contact/socials).
  - `Navbar` (brand/logo from settings) + `Footer` (settings-driven: socials, contact, category links) + `SearchModal` (live products).
  - `ProductCard` redesigned + tolerant of both API and legacy mock shapes.
  - Note: no separate announcement top-strip (offer banners on Home cover it; avoided to not break page `pt-*` offsets under the fixed navbar).

## Status / roadmap

- ✅ **Phase 1-2:** backend foundation + all content models/APIs + seed (verified against Atlas).
- ✅ **Phase 3:** full storefront rewired to API + royal redesign (Home, Products, ProductDetail, Collections, Wishlist, About, Contact, Navbar, Footer, SearchModal, ProductCard). Build passes; dev servers verified.
- ✅ **Phase 4:** `Checkout.jsx` → `POST /api/orders` (no payment) + WhatsApp order (records order, channel `whatsapp`, then opens wa.me) + success screen with order no.
- ✅ **Phase 5:** Admin panel — login gate (`AdminLayout` redirects to `/admin/login` when no token; `authStore` JWT in localStorage `sj-admin-token`). Reusable building blocks in `components/admin/`: `MediaUploader`/`MultiImageUploader` (drag-drop → `/api/upload`), `AdminUI.jsx` (`Modal`, `Field` renderer for text/textarea/number/toggle/select/multiselect/color/tags/lines/image/video, `Btn`, `Toggle`), `ResourceManager.jsx` (generic CRUD list+modal). Editors: `Products` (rich, dynamic category/collection options + multi-image), `Categories`/`CollectionsAdmin`/`Banners`/`Videos`/`Reviews`/`Gallery` (thin `ResourceManager` configs), `Orders` (list + status dropdown), `Settings` (brand/slogan/taglines/WhatsApp/socials + **live theme colour pickers**; on save calls `useSettingsCtx().refresh()` to retint the site immediately). Routes wired in `App.jsx`; admin nav in `AdminLayout`.
- ✅ **Phase 6:** `admin/Dashboard.jsx` — KPI cards (views, unique visitors, orders, revenue), visitors area chart (recharts), top pages, recent orders, off `GET /api/analytics/summary?days=`.

**All 6 phases complete.** Old admin pages (`Inventory.jsx`, `Customers.jsx`, `Reports.jsx`, `ProductForm.jsx`) are no longer routed and can be deleted. `src/data/mockData.js` is now only used by the one-time server seed — safe to remove from the web app.

## Remaining (not code — go-live)
- Set real WhatsApp number + brand/contact/socials in `/admin/settings`.
- Replace seed placeholder images/videos with real uploads (admin drag-drop).
- Change admin password (seeded `shubra@admin`) via `POST /api/auth/change-password` (or reseed with new `.env`).
- Deploy: build web (`npm run build`), run `server/` with `NODE_ENV=production` (serves `dist/` + `/uploads`) under PM2 on the Natraj2 box; nginx vhost + domain; ensure `server/uploads/` persists.
