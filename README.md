# v8gp-site

Static website for [v8gp.co.uk](https://www.v8gp.co.uk) — V8 Global brand hub.

Hosted on **GitHub Pages**. DNS and CDN via **Cloudflare**. Form backend via **Cloudflare Worker**.

---

## Repo structure

```
v8gp-site/
├── index.html          ← Home page (brand hub)
├── CNAME               ← GitHub Pages custom domain config
├── nexus/
│   └── index.html      ← V8 Nexus community intro + signup form
├── axia/
│   └── index.html      ← Axia product page
├── about/
│   └── index.html      ← About + contact
├── assets/
│   ├── css/            ← Shared styles (future)
│   ├── js/             ← Shared scripts (future)
│   └── img/            ← Images (add here, reference as /assets/img/filename)
├── worker/
│   ├── worker.js       ← Cloudflare Worker — ClickUp proxy
│   └── wrangler.toml   ← Worker deployment config
├── sitemap.xml
├── robots.txt
├── _headers            ← Cloudflare security headers
└── .gitignore
```

---

## Phase 1 deploy — Nexus subdomain only (Wix untouched)

This is the recommended first step. Gets `nexus.v8gp.co.uk` live without
touching the existing `v8gp.co.uk` Wix site.

### Step 1 — Move DNS nameservers to Cloudflare

Wix keeps running — Cloudflare copies all existing DNS records automatically.

1. Log into Cloudflare → Add a site → enter `v8gp.co.uk`
2. Cloudflare scans and imports existing DNS records (verify Wix records are present)
3. Log into GoDaddy → My Products → v8gp.co.uk → DNS → Nameservers → Change
4. Enter Cloudflare's two nameservers (shown in Cloudflare setup flow)
5. Save. Propagation: usually 1–4 hours for .co.uk

### Step 2 — Add subdomain DNS record in Cloudflare

Once nameservers have propagated, add this record in Cloudflare DNS:

| Type | Name | Target | Proxy |
|------|------|--------|-------|
| CNAME | nexus | YOUR-GITHUB-USERNAME.github.io | Proxied (orange cloud) |

Replace `YOUR-GITHUB-USERNAME` with your actual GitHub username.

### Step 3 — Enable GitHub Pages

1. Push this repo to GitHub as `v8gp-site`
2. Go to repo Settings → Pages
3. Source: Deploy from branch → `main` / `/ (root)`
4. Custom domain: `nexus.v8gp.co.uk`
5. Tick "Enforce HTTPS" once DNS has propagated
6. The `CNAME` file in this repo handles the domain config automatically

### Step 4 — Deploy the Worker

See Worker section below. Deploy to `api.v8gp.co.uk/nexus-signup`.

### Phase 2 — Full site cutover (when ready)

When ready to move the full site off Wix:

1. Update `CNAME` file: change `nexus.v8gp.co.uk` → `www.v8gp.co.uk`
2. Update GitHub Pages custom domain to `www.v8gp.co.uk`
3. Update Cloudflare DNS: add `www` CNAME → `YOUR-GITHUB-USERNAME.github.io`
4. Add redirect rule in Cloudflare: `v8gp.co.uk` → `https://www.v8gp.co.uk`
5. Cancel Wix when confirmed live

---

## Deploy — GitHub Pages

---

## Deploy — Cloudflare Worker

The Worker handles form submissions from `nexus/index.html` and posts to ClickUp.

**First-time setup:**

```bash
cd worker
npm install -g wrangler
wrangler login
```

**Set secrets (never commit these):**

```bash
wrangler secret put CLICKUP_API_KEY
wrangler secret put CLICKUP_LIST_ID
wrangler secret put RECAPTCHA_SECRET
wrangler secret put ALLOWED_ORIGIN
# Enter: https://www.v8gp.co.uk
```

**Deploy:**

```bash
wrangler deploy
```

Worker deploys to `api.v8gp.co.uk/nexus-signup`.
Add DNS record in Cloudflare: `api` → Worker route (handled automatically by wrangler.toml).

---

## Swapping in Gina's photo

In `nexus/index.html`, find the comment block inside `.gina-photo` and replace:

```html
<!-- Replace this: -->
<span class="gina-initials">GC</span>

<!-- With this: -->
<img src="/assets/img/gina-cheng.jpg" alt="Gina Cheng">
```

Add the photo file to `/assets/img/gina-cheng.jpg`. Recommended: square crop, minimum 200×200px.

---

## Swapping reCAPTCHA key

In `nexus/index.html`, find:

```html
<div class="g-recaptcha" data-sitekey="YOUR_RECAPTCHA_SITE_KEY" data-theme="dark">
```

Replace `YOUR_RECAPTCHA_SITE_KEY` with your actual site key from [google.com/recaptcha](https://www.google.com/recaptcha).
Register the domain as `v8gp.co.uk` when creating the key.

---

## Adding client one-pagers

Create a new branch per client:

```bash
git checkout -b client-acme
mkdir acme
# Add acme/index.html
git push origin client-acme
```

Deploy the branch to a subdomain or subdirectory as needed.

---

## Environment variables reference

| Variable | Where | Description |
|---|---|---|
| `CLICKUP_API_KEY` | Cloudflare Worker secret | ClickUp personal API token |
| `CLICKUP_LIST_ID` | Cloudflare Worker secret | V8 Nexus funnel list ID |
| `RECAPTCHA_SECRET` | Cloudflare Worker secret | Google reCAPTCHA v2 secret |
| `ALLOWED_ORIGIN` | Cloudflare Worker secret | `https://www.v8gp.co.uk` |

No secrets are stored in this repo. All sensitive values live in Cloudflare Worker environment.
