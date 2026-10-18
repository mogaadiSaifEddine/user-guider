# Operations

## Upgrading

```bash
git pull
npm ci
npm run build
npm run db:deploy    # apply new migrations before starting the new version
# restart the app
```

Migrations are additive in normal releases; take a backup before upgrading anyway.

`sdk.js` is served with a 5-minute cache, so sites pick up a new embed script within minutes of a deploy, without any change on their side.

## Backups

All state is in MySQL. Back it up like any other database, for example nightly:

```bash
mysqldump --single-transaction --routines guides | gzip > guides-$(date +%F).sql.gz
```

Restore into an empty database, then run `npm run db:deploy`.

## Data retention

Every guide view, step and click adds a row to the `Event` table, and nothing deletes them automatically. Analytics only reads the last 90 days at most, so older events can go. Delete in batches to avoid long locks:

```sql
DELETE FROM Event WHERE createdAt < NOW() - INTERVAL 180 DAY LIMIT 10000;
-- repeat until 0 rows are affected
```

Run it from a scheduled job. Guide progress (who completed what) is stored separately in `GuideProgress` and isn't affected.

To remove one person's data (e.g. a GDPR request), delete their row from `EndUser`; their events and progress are deleted with it:

```sql
DELETE FROM EndUser WHERE workspaceId = '<workspace id>' AND externalId = '<their user id>';
```

## Monitoring

- Logs go to standard output.
- A simple health check: `GET /sdk.js` returns 200.
- Watch the size of the `Event` table and the response time of `/api/sdk/init`, which every page load of every customer site calls.

## Security

- **Sign-up is open.** Anyone who can reach `/signup` can create an account and their own workspaces. They can't see other workspaces. To restrict it, keep the dashboard on a private network or behind your SSO proxy, while leaving `/sdk.js` and `/api/sdk/*` public for the sites that embed guides.
- **The public endpoints** (`/sdk.js`, `/api/sdk/init`, `/api/sdk/events`) accept requests from any origin by design. There's no built-in rate limiting; add it at your reverse proxy.
- **The builder endpoints** (`/api/builder/*`) only accept the short-lived token minted by the dashboard.
- **Passwords** are stored as bcrypt hashes. Sessions last 30 days.
- **`AUTH_SECRET`**: rotating it signs every dashboard user out and invalidates open builder links. It doesn't affect embedded guides.
- **AI drafting** (when `GEMINI_API_KEY` is set) sends a description of the page an author is building on (labels, headings, positions; never field values) to Google's Gemini API. See [What is sent to the AI](ai#what-is-sent-to-the-ai). Each draft is one Gemini request, triggered by an author; there's no background usage.
- **Workspace secret keys** are stored in the database in plain text because the server needs them to verify hashes. Protect database access and backups accordingly.
