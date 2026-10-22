# Deploy to AWS Lightsail

How to run User Onboarder on one Lightsail Ubuntu server, behind Caddy (HTTPS), with the database on Neon. The app is built on your computer and uploaded; the server only runs it.

Repeat the whole guide for each new server or domain. Everything that changes between deployments is in the **Values** table below.

## Values

Decide these first. Every command below uses them.

| Name | Example | Where it comes from |
| --- | --- | --- |
| `DOMAIN` | `onboarder.example.com` | The address people will open. You add its DNS record in step 2. |
| `IP` | `18.194.84.36` | The instance's **public static IP** (Lightsail → Networking). Never the private `172.26.x.x` one. |
| `KEY` | `~/.ssh/onboard` | Your SSH key (step 4). |
| Pooled database URL | `postgresql://…-pooler….neon.tech/neondb?sslmode=require` | Neon → **Connect**, *Connection pooling* on. |
| Direct database URL | `postgresql://….neon.tech/neondb?sslmode=require` | Neon → **Connect**, *Connection pooling* off. |

Use a separate Neon database for each deployment unless they should share data.

On your computer, open **Git Bash** in the project folder and set the values for this session:

```bash
DOMAIN=onboarder.example.com
IP=18.194.84.36
KEY=~/.ssh/onboard
```

## 1. Create the instance (Lightsail console)

1. **Lightsail → Instances → Create instance.** Not *Containers*: that is a different product that needs a Docker image.
2. Platform **Linux/Unix**, blueprint **OS Only → Ubuntu 24.04 LTS**.
3. Region: the same AWS region as the Neon database (each page load makes several database queries).
4. Plan: **1 GB** is enough, because the app is built on your computer, not on the server.
5. **Networking → Create static IP** and attach it to the instance. This is your `IP`.
6. **Networking → IPv4 Firewall**: make sure there are rules for **SSH (22)**, **HTTP (80)** and **HTTPS (443)**, all *Any IPv4 address*. Click **Create** on each new rule, or it is not saved. Add HTTP and HTTPS to the **IPv6 Firewall** too.

A missing HTTPS (443) rule shows up as *ERR_CONNECTION_TIMED_OUT* in the browser while HTTP still answers.

## 2. DNS record

At the DNS provider of the domain, add:

| Type | Name | Value |
| --- | --- | --- |
| A | `onboarder` (or the full `DOMAIN`) | `IP` |

If the domain is on Cloudflare, set it to *DNS only* (grey cloud). Check from Git Bash; it must print your `IP`:

```bash
nslookup $DOMAIN
```

## 3. Set up the server (once per server)

Open the instance's browser terminal (**Connect using SSH** in Lightsail). Paste with the **Paste into terminal** button; Ctrl+V does not work there.

First set the domain on the server too:

```bash
DOMAIN=onboarder.example.com
```

Updates, Node.js 22 and Caddy:

```bash
sudo apt-get update && sudo apt-get upgrade -y
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo bash -
sudo apt-get install -y nodejs debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/gpg.key | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt-get update && sudo apt-get install -y caddy
sudo mkdir -p /opt/user-onboarder/app && sudo chown -R ubuntu:ubuntu /opt/user-onboarder
```

Do not run `do-release-upgrade`; stay on Ubuntu 24.04.

### Secrets

```bash
sudo tee /etc/user-onboarder.env > /dev/null <<EOF
DATABASE_URL=PASTE_POOLED_URL
DIRECT_URL=PASTE_DIRECT_URL
AUTH_SECRET=$(openssl rand -hex 32)
NEXT_PUBLIC_APP_URL=https://$DOMAIN
GEMINI_API_KEY=
EOF
sudo chmod 600 /etc/user-onboarder.env
sudo nano /etc/user-onboarder.env
```

In nano, replace `PASTE_POOLED_URL` and `PASTE_DIRECT_URL` with the two Neon URLs (only the `postgresql://…` part, no `psql` and no quotes). Add a Gemini key if you want AI drafting. One variable per line, no spaces around `=`. Save with **Ctrl+O**, **Enter**, exit with **Ctrl+X**. `AUTH_SECRET` is already generated.

### Service and HTTPS

```bash
sudo tee /etc/systemd/system/user-onboarder.service > /dev/null <<'EOF'
[Unit]
Description=User Onboarder
After=network-online.target

[Service]
User=ubuntu
WorkingDirectory=/opt/user-onboarder/app
EnvironmentFile=/etc/user-onboarder.env
Environment=NODE_ENV=production HOSTNAME=127.0.0.1 PORT=3000
ExecStart=/usr/bin/node server.js
Restart=always

[Install]
WantedBy=multi-user.target
EOF

sudo tee /etc/caddy/Caddyfile > /dev/null <<EOF
$DOMAIN {
	encode zstd gzip
	reverse_proxy 127.0.0.1:3000
}
EOF

sudo systemctl daemon-reload
sudo systemctl enable user-onboarder
sudo systemctl restart caddy
sudo reboot
```

The app does not start yet; it is uploaded in step 7.

## 4. SSH key for uploads (once per computer and server)

The downloaded Lightsail key often does not match the instance (other region, other key). Your own key always works:

```bash
[ -f ~/.ssh/onboard ] || ssh-keygen -t ed25519 -f ~/.ssh/onboard -N ""
cat ~/.ssh/onboard.pub
```

Copy the printed `ssh-ed25519 …` line, then in the server's browser terminal:

```bash
echo "PASTE_THE_LINE_HERE" >> ~/.ssh/authorized_keys
```

Test from Git Bash (type `yes` the first time):

```bash
ssh -i $KEY ubuntu@$IP "echo connected"
```

## 5. Prepare the project (once per checkout)

Check that these are in the code; add them if not.

`next.config.ts`:

```ts
const nextConfig: NextConfig = {
  output: "standalone",
  // Without this, a package.json or lockfile in a parent folder nests the build in .next/standalone/<folder>/.
  outputFileTracingRoot: process.cwd(),
  // ...rest unchanged
```

`prisma/schema.prisma`:

```prisma
generator client {
  provider      = "prisma-client-js"
  // The server's Prisma engine, so a build made on Windows or macOS runs there.
  binaryTargets = ["native", "debian-openssl-3.0.x"]
}
```

Then:

```bash
npm install
```

Use `npm install`, not `npm ci`: the lockfile may be out of sync.

## 6. Build and package (every deploy)

The public URL is fixed into the build, so it must be the domain of the server you deploy to:

```bash
rm -rf .next
NEXT_PUBLIC_APP_URL=https://$DOMAIN npm run build

ls .next/standalone/server.js && \
rm -rf deploy-out app.tgz && mkdir -p deploy-out/.next deploy-out/node_modules/.prisma && \
cp -r .next/standalone/. deploy-out/ && \
cp -r .next/static deploy-out/.next/static && \
cp -r public deploy-out/public && \
cp -r node_modules/.prisma/client deploy-out/node_modules/.prisma/ && \
rm -f deploy-out/.env* && \
tar -czf app.tgz -C deploy-out . && ls -lh app.tgz

ls deploy-out/node_modules/.prisma/client | grep debian
```

The last command must print `libquery_engine-debian-openssl-3.0.x.so.node`. `rm -f deploy-out/.env*` matters: the build copies your local `.env` into the output, and it must never reach the server.

## 7. Migrate, upload, start (every deploy)

Database migrations, with the same Neon URLs as in `/etc/user-onboarder.env` (needed the first time and whenever `prisma/migrations` changed):

```bash
DATABASE_URL="PASTE_POOLED_URL" DIRECT_URL="PASTE_DIRECT_URL" npx prisma migrate deploy
```

Upload and restart:

```bash
scp -i $KEY app.tgz ubuntu@$IP:/tmp/
ssh -i $KEY ubuntu@$IP "rm -rf /opt/user-onboarder/app && mkdir -p /opt/user-onboarder/app && tar -xzf /tmp/app.tgz -C /opt/user-onboarder/app && rm /tmp/app.tgz && sudo systemctl restart user-onboarder"
```

## 8. Check

```bash
ssh -i $KEY ubuntu@$IP "sudo systemctl status user-onboarder --no-pager | head -5; curl -s -o /dev/null -w 'local: %{http_code}\n' http://127.0.0.1:3000/login"
curl -s -o /dev/null -w "public: %{http_code}\n" https://$DOMAIN/login
```

Expect `active (running)`, `local: 200` and `public: 200`. Then open `https://DOMAIN/login`, sign up, and check that the snippet on the **Install** page loads `https://DOMAIN/sdk.js`, not `localhost`.

Optional: Lightsail → instance → **Snapshots → Enable automatic snapshots**.

## Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| Browser: *ERR_CONNECTION_TIMED_OUT* | Port 443 closed in the Lightsail firewall | Step 1.6, then `sudo systemctl restart caddy` |
| `curl http://IP` answers 308, `https://IP` times out | Same | Same |
| Certificate error in the first minute | Caddy is still getting the certificate | Wait, reload. If it stays: `sudo journalctl -u caddy -n 30 --no-pager` |
| `nslookup DOMAIN` shows another IP | DNS record wrong or not live yet | Step 2, wait a few minutes |
| `Permission denied (publickey)` | Wrong or missing key file | Step 4 |
| `Identity file … not accessible` | Key file not at that path | `ls ~/.ssh`, fix `KEY` |
| `cp: cannot create directory 'deploy-out/.next/static'` | Build was not standalone | Step 5, rebuild |
| `.next/standalone` contains only a folder and `package.json` | Build nested under a parent folder | `outputFileTracingRoot` in step 5, `rm -rf .next`, rebuild |
| App crashes, logs mention the Prisma query engine | Linux engine missing | `binaryTargets` in step 5, `npx prisma generate`, step 6 |
| Install snippet points to `localhost` or the old domain | Built with the wrong `NEXT_PUBLIC_APP_URL` | Step 6 with the right `DOMAIN` |
| Anything else | | `ssh -i $KEY ubuntu@$IP "sudo journalctl -u user-onboarder -n 50 --no-pager"` |

## Moving an existing server to a new domain

1. DNS record for the new domain (step 2).
2. On the server:
   ```bash
   NEW=onboarder.new-domain.com
   sudo sed -i "1s/.*/$NEW {/" /etc/caddy/Caddyfile
   sudo sed -i "s#^NEXT_PUBLIC_APP_URL=.*#NEXT_PUBLIC_APP_URL=https://$NEW#" /etc/user-onboarder.env
   sudo systemctl restart caddy
   ```
3. On your computer: set `DOMAIN` to the new domain and repeat steps 6 and 7 (migrations not needed).
