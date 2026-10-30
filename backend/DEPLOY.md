# Deploy (server: node.carcomfort.betaplanets.com)

Goal:

- Node API on **HTTP localhost:4001**
- Next.js admin panel on **HTTP localhost:4002** (served at `/admin` via `basePath`)
- Nginx terminates TLS and routes `/admin` → 4002, everything else → 4001

Public admin URL: `https://node.carcomfort.betaplanets.com/admin/login`

## 0) Security note (do this first)

If the SSH password was shared publicly, rotate it immediately.

## 1) SSH to server

```bash
ssh -p 2208 carcomf@35.184.227.195
```

## 2) Go to app directory

```bash
cd ~/apps/car-comfort
```

## 3) Install Node + dependencies

If Node isn’t installed, use your server’s standard method (nvm / apt / etc). Then:

```bash
npm ci --omit=dev
```

## 4) Configure environment (DB + app)

This app reads env from (in order): `DOTENV_CONFIG_PATH`, then `.env.production` (when `NODE_ENV=production`), then `.env`.

Create `~/apps/car-comfort/.env.production`:

```bash
nano .env.production
```

Minimum required variables:

```bash
NODE_ENV=production
PORT=4001

DB_HOST=...
DB_PORT=3306
DB_NAME=...
DB_USER=...
DB_PASSWORD=...

# Optional
UPLOAD_DIR=uploads
UPLOAD_PUBLIC_BASE=/uploads
JWT_SECRET=change-me

# Mail (optional but recommended for welcome emails)
MAIL_HOST=
MAIL_PORT=2525
MAIL_USERNAME=
MAIL_PASSWORD=
MAIL_ENCRYPTION=tls
MAIL_FROM_ADDRESS="no-reply@example.com"
MAIL_FROM_NAME="Car Comfort"
MAIL_DEBUG=false

# Used by email template logo fallback
PUBLIC_BASE_URL=https://node.carcomfort.betaplanets.com
# Optional: override email logo image URL
EMAIL_LOGO_URL=

# Allow admin panel origin (browser + socket.io)
CORS_ORIGIN=https://node.carcomfort.betaplanets.com
```

DB creds are available on the server at `~/apps/backup` (per your note). Copy them into the env file.

## 5) Run migrations (required after deploy)

```bash
npm run db:migrate:prod
```

Or:

```bash
NODE_ENV=production npx sequelize-cli db:migrate
```

If EV booking fails with `Unknown column 'charger_type'`, the production DB is behind. Run the command above, then restart the API. On startup the server also attempts to add missing `charger_type` / `current_battery_status` columns automatically.

## 6.1) Admin driver approve/reject

Admin endpoints (must be called with an admin JWT):

- `POST /api/admin/drivers/:userId/approve`
- `POST /api/admin/drivers/:userId/reject` with body `{ "reason": "..." }`

## 6) Admin panel (port 4002, path `/admin`)

Create `~/apps/car-comfort/admin-panel/.env.production`:

```bash
NEXT_PUBLIC_APP_URL=https://node.carcomfort.betaplanets.com/admin
NEXT_PUBLIC_API_URL=https://node.carcomfort.betaplanets.com
NEXT_PUBLIC_BASE_PATH=/admin
```

Build (required after any env change):

```bash
cd ~/apps/car-comfort
# Stop first: never replace .next while Next.js is serving the previous build.
pm2 stop car-comfort-admin
cd admin-panel
npm ci
npm run build
cd ~/apps/car-comfort
pm2 restart car-comfort-admin --update-env
```

Never build the admin panel while `car-comfort-admin` is running. Replacing `.next`
in place while Next.js serves the previous manifest causes requests for deleted
hashed chunks and results in `ChunkLoadError` blank pages.

## 7) Run as a service with PM2

Install PM2 once:

```bash
npm i -g pm2
```

From `~/apps/car-comfort`, start API + admin (uses `ecosystem.config.cjs`):

```bash
cd ~/apps/car-comfort
pm2 start ecosystem.config.cjs
# or, if API is already running:
pm2 start ecosystem.config.cjs --only car-comfort-admin
pm2 save
pm2 startup
```

Check:

```bash
pm2 status
curl -sS http://127.0.0.1:4001/health
curl -sS -o /dev/null -w "%{http_code}\n" http://127.0.0.1:4002/admin/login
```

## 8) Nginx reverse proxy (DevOps)

Keep Node and Next **HTTP only** on localhost. Nginx serves HTTPS and splits by path:

```nginx
server {
  server_name node.carcomfort.betaplanets.com;

  location /admin {
    proxy_pass http://127.0.0.1:4002;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  location / {
    proxy_pass http://127.0.0.1:4001;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
  }

  # Tutorial videos support files up to 400 MB. Keep this above that limit.
  client_max_body_size 450m;
  proxy_read_timeout 900s;
  proxy_send_timeout 900s;
}
```

After updating the live Nginx configuration, validate and reload it:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

Do **not** use a trailing slash on `proxy_pass` for `/admin` (e.g. avoid `http://127.0.0.1:4002/`), or paths will break.

Optional redirect root to admin:

```nginx
location = / {
  return 302 /admin/;
}
```

Use Certbot or your existing TLS setup to enable HTTPS for the domain.

Public check:

```bash
curl -sS -o /dev/null -w "%{http_code}\n" https://node.carcomfort.betaplanets.com/admin/login
```
