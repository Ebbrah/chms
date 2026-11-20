# VM public access (single parish, self-hosted Supabase)

Goal: users open **https://chms.lutherankijitonyama.org**; the app talks to **https://api.chms.lutherankijitonyama.org** (Kong).

## Layouts

### A. Two VMs (KLCERP: app on `.35`, Supabase on `.36`)

| DNS name | A record → | VM | Caddy file |
|----------|------------|-----|------------|
| `chms` | public IP of **192.168.100.35** | Next.js `:3000` | `deploy/Caddyfile.app-only` |
| `api.chms` | public IP of **192.168.100.36** | Kong `:8000` | `deploy/Caddyfile.api-only` |

```text
https://chms…  → .35 :443 (Caddy) → 127.0.0.1:3000 (Next.js)
https://api.chms… → .36 :443 (Caddy) → 127.0.0.1:8000 (Kong)
```

Steps **3–7** call out **`.35`** vs **`.36`** where they differ. Run **step 2 (UFW)** on **both** VMs.

### B. Single VM (everything on one box)

Use combined `deploy/Caddyfile`. Both DNS A records point to the **same** public IP.

```text
Internet :443
    ├── chms.lutherankijitonyama.org      → 127.0.0.1:3000  (Next.js)
    └── api.chms.lutherankijitonyama.org  → 127.0.0.1:8000  (Supabase Kong)

Not public: Postgres, Studio (:54323), Inbucket, raw :8000 on 0.0.0.0
```

## 1. DNS (GoDaddy)

**Two VMs:** different IPs per row.

| Type | Name   | Value (two-VM) | Value (single-VM) |
|------|--------|----------------|-------------------|
| A    | `chms` | **.35** public IP | One VM IPv4 |
| A    | `api.chms` | **.36** public IP | Same IPv4 |

Wait until both resolve:

```bash
dig +short chms.lutherankijitonyama.org
dig +short api.chms.lutherankijitonyama.org
```

## 2. Firewall on the VM

Run on **both `.35` and `.36`** when using the two-VM layout (each host terminates HTTPS for its own hostname).

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status
```

Do **not** open `3000/tcp` (`.35`) or `8000/tcp` (`.36`) publicly once Caddy is working.

## 3. Bind services to localhost

**On `.35` (Next.js only)** — use `deploy/chms.service` or:

```bash
npm run start -- --hostname 127.0.0.1 --port 3000
```

**On `.36` (Kong only)** — in Supabase Docker Compose, publish API only on loopback:

```yaml
ports:
  - "127.0.0.1:8000:8000"
```

Then `docker compose up -d` on `.36`. If Kong was on `0.0.0.0:8000`, close public access after Caddy works (UFW should not allow `8000/tcp` from the internet).

Confirm nothing sensitive is on `0.0.0.0`:

```bash
# On .35
sudo ss -tlnp | egrep '3000|8000'

# On .36
sudo ss -tlnp | egrep '8000|5432|54323'
```

## 4. HTTPS reverse proxy (Caddy)

Install Caddy on **each VM that has a public hostname** (`.35` and `.36` in the two-VM layout).

**VM `.35` (app):**

```bash
sudo apt install -y caddy
sudo cp deploy/Caddyfile.app-only /etc/caddy/Caddyfile
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl enable --now caddy
```

**VM `.36` (API):**

```bash
sudo apt install -y caddy
sudo cp deploy/Caddyfile.api-only /etc/caddy/Caddyfile
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl enable --now caddy
```

**Single VM:** use `deploy/Caddyfile` instead of the two files above.

Caddy obtains Let's Encrypt certificates automatically once DNS points to **that** server and ports 80/443 are reachable.

## 5. Supabase Auth / public API URLs

**On `.36` only**, edit Supabase Docker `.env` (often `~/supabase-project/.env`) using `deploy/env.supabase-docker.patch.example`, then restart the stack:

```bash
cd ~/supabase-project
docker compose down && docker compose up -d
```

Critical:

- `SITE_URL` = app origin (`https://chms…`)
- `ADDITIONAL_REDIRECT_URLS` includes `/auth/callback` and `/login`
- `API_EXTERNAL_URL` / `SUPABASE_PUBLIC_URL` = `https://api.chms…`

Copy **anon** and **service_role** keys from **`.36`** `.env` into the app env on **`.35`**.

## 6. ChMS app environment

**On `.35` only:**

```bash
cp deploy/env.chms.production.example /opt/chms/.env.production
chmod 600 /opt/chms/.env.production
# edit CHMS_PARISH_SLUG, keys from .36 Supabase .env
cd /opt/chms && npm ci && npm run build
sudo cp deploy/chms.service /etc/systemd/system/chms.service
# fix User= and WorkingDirectory= if not chms:/opt/chms
sudo systemctl daemon-reload
sudo systemctl enable --now chms
```

`NEXT_PUBLIC_*` variables are inlined at **build** time — run `npm run build` on **`.35`** after changing them.

## 7. Database bootstrap (once per new DB)

**On `.36`** (Postgres lives here). After migrations are applied to that database, run `supabase/scripts/onprem_single_parish_bootstrap.sql`:

- **Studio:** SSH tunnel to `.36`, open Studio locally, SQL editor — or
- **psql:** from `.36`, `docker exec` into the DB container or use the stack’s connection string.

Do not run bootstrap against cloud/Vercel Supabase if this parish is on-prem only.

## 8. Smoke tests

```bash
curl -sI https://chms.lutherankijitonyama.org | head -5
curl -sI https://api.chms.lutherankijitonyama.org/rest/v1/ | head -5
```

## 8b. WhatsApp sign-in (same verification as Ebenezer)

Email confirmation is off on the VM stack, so email/password does not prove the person owns the address. The public site should use parish `auth_mode = whatsapp`: the member enters a phone number, WhatsApp delivers a 6-digit code, and only then is a session created. That path runs on the Next.js server (`chms…`), so the browser does not call `api.chms…/auth/v1/token` the way the email form does. A failed request to that token URL is the login-page network error.

On **`.36`**, after migrations through `20260829160000_whatsapp_link_phone.sql`:

```bash
# psql or Studio SQL editor
# supabase/scripts/onprem_enable_whatsapp_auth.sql
```

On **`.35`**, put the Meta values in `/opt/chms/.env.production` (see `deploy/env.chms.production.example`), then rebuild and restart. `META_WHATSAPP_*` is read on the server at runtime; a rebuild is still required if `NEXT_PUBLIC_*` changed in the same edit.

```bash
cd /opt/chms && sudo systemctl restart chms
```

Open `https://chms.lutherankijitonyama.org/login`. It should redirect to `?parish=klc` and show the WhatsApp code form, not email and password. Members who already have an email account use `/join/klc/sasisha-whatsapp` once to attach their WhatsApp number.

In a browser:

1. Open `https://chms.lutherankijitonyama.org/login` and request a WhatsApp code
2. Sign up from `https://chms.lutherankijitonyama.org/join/klc` with the same code flow
3. Upload or view an image from Supabase Storage (checks `next.config.ts` image host)

## 9. Security notes

- Do not expose Supabase Studio on the public internet; use SSH tunnel if needed.
- Keep `SUPABASE_SERVICE_ROLE_KEY` only in `.env.production` on the server.
- Prefer SSH keys; restrict who can sudo.
- Configure real SMTP before relying on password reset in production.

## Troubleshooting

| Symptom | Check |
|---------|--------|
| NXDOMAIN | DNS not propagated or wrong host name at registrar |
| Certificate errors | Port 80 blocked; wrong IP; Caddy logs `journalctl -u caddy` |
| Login redirect loop | `SITE_URL` / redirect URLs in Supabase `.env` |
| CORS errors in browser | `API_EXTERNAL_URL` must match `NEXT_PUBLIC_SUPABASE_URL` exactly (scheme + host) |
| 502 on api subdomain | Kong not on `127.0.0.1:8000`; `docker compose ps` |
