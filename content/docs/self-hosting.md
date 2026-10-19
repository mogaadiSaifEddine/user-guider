# Deploy

User Onboarder is one Next.js application and one PostgreSQL database. The app serves the dashboard, the docs, the API and the `sdk.js` embed script.

## Requirements

- Node.js 20 or newer
- PostgreSQL 14 or newer, for example [Neon](https://neon.tech) (a database and a user that can create tables)
- HTTPS in front of the app. In production the login cookie is only sent over HTTPS, so sign-in fails on plain HTTP.

## Environment variables

| Variable | Example | Notes |
| --- | --- | --- |
| `DATABASE_URL` | `postgresql://guides:secret@ep-xxx-pooler.eu-central-1.aws.neon.tech/guides?sslmode=require` | Connection string the app uses. On Neon, use the pooled one (host contains `-pooler`). |
| `DIRECT_URL` | `postgresql://guides:secret@ep-xxx.eu-central-1.aws.neon.tech/guides?sslmode=require` | Direct (unpooled) connection, used by `npm run db:deploy`. Without a pooler, set it to the same value as `DATABASE_URL`. |
| `AUTH_SECRET` | output of `openssl rand -base64 48` | Signs login sessions and builder links. At least 32 random characters. Changing it signs everyone out. |
| `NEXT_PUBLIC_APP_URL` | `https://guides.example.com` | Public address of the app, used in the snippet on the Install page. Set it **before building**. |
| `PORT` | `3000` | Port for `npm start`. |
| `GEMINI_API_KEY` | from [Google AI Studio](https://aistudio.google.com/apikey) | Optional. Turns on [AI drafting](ai) in the builder. Without it, the AI options are hidden. |
| `GEMINI_MODEL` | `gemini-3.8-flash` | Optional. Gemini model used for drafting. Defaults to `gemini-3.8-flash` (about 5 seconds per draft). Lighter models such as `gemini-3.1-flash-lite` are faster and cheaper but pick weaker steps. |
| `GEMINI_THINKING` | `LOW` | Optional. For Gemini 3 models: `LOW` (default), `MEDIUM` or `HIGH`. Higher can improve drafts on complex pages but takes longer. |

## Build and run

```bash
git clone <repository> user-onboarder && cd user-onboarder
npm ci
npm run build        # bundles sdk.js, generates the database client, builds Next.js
npm run db:deploy    # applies database migrations
npm start            # serves on $PORT (default 3000)
```

Run it under a process manager (systemd, PM2, a container platform) and put a reverse proxy with HTTPS in front.

The app is stateless: you can run several instances behind a load balancer, as long as they share the database and the same `AUTH_SECRET`.

## First account

Open `/signup` and create an account, then a workspace. Sign-up is open to anyone who can reach the server; see [Operations](operations#security) if that's a concern.

## Local development

```bash
cp .env.example .env # then set DATABASE_URL and DIRECT_URL to a Neon branch
npm install
npm run db:migrate
npm run db:seed      # optional demo data: demo@useronboarder.local / demo1234
npm run dev          # http://localhost:3000, demo site at /demo.html
```

`npm run dev:sdk` rebuilds `sdk.js` on every change to `sdk/`.

On Windows, stop the dev server before `npm run build`. Otherwise Prisma can't replace a locked file and the build fails with `EPERM`.
