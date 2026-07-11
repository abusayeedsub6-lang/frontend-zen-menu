# Menu Mate — React App

Full React migration of the ZEN MENU / Menu Mate restaurant app.

## Setup

```bash
cd zen-menu
cp .env.example .env   # if .env is missing — set Supabase URL and anon key
npm install
npm run dev
```

Open http://localhost:5173

## Routes

| Route | App area |
|-------|----------|
| `/` | Admin Google login |
| `/admin` | Order summary (protected) |
| `/admin/manage-menu` | Manage menu — categories, dishes, offers, theme, staff |
| `/menu?admin_id=` | Customer menu |
| `/menu/:restaurantId` | Customer menu (path param) |
| `/orders` | Customer order history |
| `/staff` | Staff login |
| `/staff/dashboard` | Staff home (protected) |
| `/staff/place-order` | Staff place order |
| `/staff/orders-by-me` | Staff's own orders |
| `/staff/all-orders` | All restaurant orders (48h) |

Legacy `.html` paths (e.g. `/user-side/menu.html`) redirect automatically to the routes above.

## Migration status

| Phase | Scope | Status |
|-------|--------|--------|
| **1** | Vite, React Router, Supabase client, shared CSS | ✅ |
| **2** | User menu, cart, my orders | ✅ |
| **3** | Admin login, orders, manage menu | ✅ |
| **4** | Staff login, dashboard, place order, orders | ✅ |
| **5** | Production cutover, code splitting, hosting config | ✅ |

The original static app in the parent folder (`admin-side/`, `user-side/`, `staff-side/`) is kept for reference. **Production should deploy only `zen-menu/dist`.**

## Production deployment

### Build

```bash
npm run build
npm run preview   # test production build locally at http://localhost:4173
```

Output is in `dist/`. Deploy that folder as your site root.

### Hosting (SPA)

Client-side routing needs all paths to serve `index.html`. Config is included for:

- **Netlify** — `netlify.toml` + `public/_redirects`
- **Vercel** — `vercel.json`

### Supabase

1. In Supabase Dashboard → Authentication → URL configuration, add:
   - Site URL: `https://your-domain.com`
   - Redirect URLs: `https://your-domain.com/admin`
2. Ensure `.env` (or host env vars) sets:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

### Environment variables on hosts

| Platform | Variable names |
|----------|----------------|
| Vercel / Netlify | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` |

## Architecture notes

- **User flows** — full React (`MenuPage`, `MyOrdersPage`, cart context)
- **Admin / staff heavy screens** — legacy JS adapters under `src/admin/legacy/` and `src/staff/legacy/` for parity with the original app
- **Code splitting** — routes load on demand; legacy admin/staff bundles are separate chunks

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Development server |
| `npm run build` | Production build → `dist/` |
| `npm run preview` | Serve `dist/` locally |
| `npm run lint` | Run oxlint |
