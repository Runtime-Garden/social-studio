# Publishing Runtime Garden Social Studio behind Nginx Proxy Manager

This is the P6 deployment path. Read the whole page before deploying: two
settings below are the difference between a working deployment and one
where login silently fails.

## 0. Current verified state

- The app runs and is fully tested locally (174 vitest assertions,
  45 browser journeys, offline standalone byte-identical).
- `docker build` and `compose up` have **never been executed in this
  repository's environment** (no Docker daemon available when the stack was
  written). Treat the first `docker compose up` on your host as the first
  real run of the image and check the logs.
- No Buffer or LLM integration exists yet, so nothing here publishes
  anywhere.

## 1. Required: put NPM and the app on one Docker network

The stack publishes **no host port**. That is deliberate: if port 8787 is
published on `0.0.0.0`, the app is reachable directly and the proxy is
bypassable ("origin protection" in the blueprint).

In Dockge, the simplest approach is one shared network for both stacks:

```bash
docker network create proxy
```

Then, on the app stack in Dockge, add the network to `compose.yaml`:

```yaml
services:
  web:
    # ... existing keys ...
    networks:
      - proxy

networks:
  proxy:
    external: true
```

NPM itself must also join that network. In NPM's own compose:

```yaml
services:
  app:
    networks:
      - proxy
networks:
  proxy:
    external: true
```

Redeploy both stacks after editing so the containers are attached.

## 2. NPM proxy host

Add Host → Proxy Hosts → **Add Proxy Host**:

| Field | Value |
|---|---|
| Domain Names | `studio.yourdomain.com` |
| Scheme | `http` |
| Forward Hostname / IP | `web` |
| Forward Port | `8787` |
| Block Common Exploits | on |
| Websockets Support | off (not needed) |

`web` is the compose service name. If you kept the app stack in a
different network and NPM cannot resolve `web`, use the app container's
bridge IP (`docker inspect -f '{{.NetworkSettings.IPAddress}}' <id>`) —
but prefer the shared network, because a container IP survives restarts
less reliably than a service name.

Then in the **SSL** tab: request a new Let's Encrypt certificate, enable
**Force SSL** and **HTTP/2**.

Dockge note: if you edit `compose.yaml`, edit it as a stack file in the
Dockge UI or the repo file and redeploy — a `git pull` alone does not
redeploy.

## 3. Non-negotiable environment settings

`.env` (never committed; the stack refuses to start if the admin pair is
half-set):

```bash
RG_ADMIN_USERNAME=owner
RG_ADMIN_PASSWORD=<long random value>
NODE_ENV=production
```

`NODE_ENV=production` forces **Secure** session cookies. That is correct
behind NPM with a real certificate, and it means: **if you open the app
over plain `http://` — for example by IP and port, skipping the proxy —
login will fail silently**, because the browser refuses to send a Secure
cookie over http. Use `https://studio.yourdomain.com`.

Two settings worth being explicit about:

- `RG_TRUST_PROXY_HOPS=1` — already set in `compose.yaml`. Without it
  every request looks like it comes from the Docker gateway, so five
  failed logins from one visitor would lock out **all** visitors. Do not
  set it if the port ever becomes directly reachable: it would let clients
  forge their own rate-limit key.
- `RG_SECURE_COOKIES` — leave unset; production forces it on.

## 4. Seed and smoke test

```bash
# from the stack directory in Dockge (or the repo)
docker compose exec web node tools/seed-fixtures.cjs /app/data/studio.sqlite

curl -fsS https://studio.yourdomain.com/health/live   # {"status":"ok"}
curl -fsS https://studio.yourdomain.com/health/ready  # {"status":"ready","migrations":2}
curl -fsS -o /dev/null -w '%{http_code}\n' https://studio.yourdomain.com/login   # 200
```

Then in the browser: sign in, open `/studio/`, `/content/`, `/calendar/`.
Verify a Secure cookie was set (`rg_session=...; Secure; HttpOnly;
SameSite=Strict`) in devtools → Application → Cookies.

## 5. Not yet done (P6, still open)

These are real gaps between "it runs behind NPM" and the blueprint's P6
DoD, and I have not implemented any of them:

- **No TLS termination test or certificate-automation check** — verify the
  Let's Encrypt renewal works for your DNS setup.
- **No Cloudflare Access / additional auth layer in front** (blueprint
  mentions it) — currently the only gate is the app's own login.
- **No backups/restore rehearsal.** `studio-data` holds the SQLite
  database; `docker compose down -v` destroys it. Back up the volume before
  any destructive command, and never use `-v` casually.
- **No CI run of `docker build`** — the image has no executed build
  evidence. Run `docker build .` once yourself, or add it to CI.
- **No observability beyond `/health/*`** — no log shipping, alerting or
  metrics.

## 6. Quick troubleshooting

| Symptom | Cause |
|---|---|
| Login button does nothing / instantly back to login | You are on `http://`, not through the proxy — Secure cookie is dropped. |
| 502 Bad Gateway | NPM cannot reach the app: check the shared network, and that the forward hostname is `web` (the service name). |
| 429 on every login after 5 wrong tries | `RG_TRUST_PROXY_HOPS` is not set to 1 — the limiter sees the gateway IP for everyone. |
| "No users exist and no admin bootstrap credentials were provided" at startup | `.env` is missing `RG_ADMIN_USERNAME`/`RG_ADMIN_PASSWORD` as a pair. |
| `unable to open database file` | Fixed in `50b2025`; only possible with a pre-fix image — rebuild. |
