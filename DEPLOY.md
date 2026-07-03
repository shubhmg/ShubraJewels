# Deploying Shubra Jewels

**How it works:** one Node process (Express, port 4200) serves *both* the built React
site and the `/uploads` media, talking to MongoDB Atlas. nginx sits in front for the
domain + HTTPS. No separate web host, no build step on the server.

```
Browser ──HTTPS──▶ nginx ──▶ 127.0.0.1:4200 (Express)
                                 ├─ /api/*      → API
                                 ├─ /uploads/*  → media
                                 └─ everything else → dist/ (React app)
```

---

## Fastest path: `setup-server.sh`

On the server, one command does the whole bootstrap (clone → build → seed → PM2),
and optionally nginx + HTTPS:
```bash
curl -fsSL https://raw.githubusercontent.com/shubhmg/ShubraJewels/main/setup-server.sh -o setup-server.sh
bash setup-server.sh                              # first run writes server/.env, then stops
nano /var/www/shubra/server/.env                  # fill MONGODB_URI password + admin creds
bash setup-server.sh --nginx shop.yourdomain.com  # build, seed, start, nginx vhost + certbot HTTPS
```
Point your domain's DNS A-record at the server first, so certbot can validate.
After this, deploy updates from your laptop with `bash deploy.sh`. The manual steps
below are the same thing spelled out.

---

## One-time setup, manual (~15 min)

`deploy.sh` uses **git pull on the server**, so the code must live in a git repo the
server can clone. Do this once.

**0. Put the code on GitHub (from your laptop)**
```bash
cd ShubraJewels
git init && git add . && git commit -m "Shubra Jewels"
git branch -M main
git remote add origin git@github.com:YOU/shubra.git   # create this repo first
git push -u origin main
```

**1. Clone it on the server** (same box as Natraj2 — has Node + PM2 + nginx)
```bash
git clone git@github.com:YOU/shubra.git /var/www/shubra
mkdir -p /var/www/shubra/server/uploads
```

**2. Create the server env file** — `nano /var/www/shubra/server/.env`:
```
PORT=4200
NODE_ENV=production
MONGODB_URI=mongodb+srv://ntj:PASSWORD@cluster0.um15q.mongodb.net/shubra?retryWrites=true&w=majority
JWT_SECRET=<paste a long random string>
JWT_EXPIRES_IN=30d
ADMIN_EMAIL=you@shubrajewels.in
ADMIN_PASSWORD=<a strong password>
PUBLIC_URL=
```
(`.env` and `server/uploads/` are gitignored, so deploys never touch them.)

**3. First deploy from your laptop** — edit the top of `deploy.sh` (`SSH_HOST`,
`APP_DIR`, `BRANCH`), then:
```bash
bash deploy.sh
```

**4. Seed the database once** (creates the admin + starter content):
```bash
ssh user@your-server 'cd /var/www/shubra/server && npm run seed'
```

**4. nginx vhost** — `/etc/nginx/sites-available/shubra`:
```nginx
server {
    server_name shop.yourdomain.com;
    client_max_body_size 60M;        # allow video uploads

    location / {
        proxy_pass http://127.0.0.1:4200;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```
```bash
ln -s /etc/nginx/sites-available/shubra /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
certbot --nginx -d shop.yourdomain.com     # free HTTPS
pm2 startup && pm2 save                     # survive reboots
```

Done. Visit `https://shop.yourdomain.com` (admin at `/admin`).

---

## Every deploy after that

Commit your changes, then from your laptop:
```bash
git commit -am "update"
bash deploy.sh
```
`deploy.sh` pushes, then the server pulls, `npm ci`, `npm run build`, and restarts
PM2. Your `.env` and uploaded images/videos on the server are never touched.

## Handy
```bash
pm2 logs shubra          # view logs
pm2 restart shubra       # manual restart
```

**Change the admin password** after first login: it's the `ADMIN_PASSWORD` in the
server `.env` (re-running `npm run seed` resets it), or via
`POST /api/auth/change-password`.
