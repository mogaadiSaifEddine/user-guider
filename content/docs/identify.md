# Identify users

Identifying tells Locatify Guides who is signed in. It's what makes progress follow a person across devices, lets authors target by plan or role, and shows real ids in analytics.

```js
LocatifyGuides.identify(userId, attributes, options);
```

| Argument | Type | Notes |
| --- | --- | --- |
| `userId` | string | Stable and unique per user: your database id, not an email that can change. Up to 191 characters. |
| `attributes` | object, optional | Values can be strings (up to 1000 characters), numbers, booleans or `null`. Keys up to 100 characters. |
| `options.hash` | string, optional | Signature for [identity verification](identity-verification). |

## When to call it

Call it **once per page load**, as soon as you know who the user is, typically right after your app loads the session or completes a login.

Each call reloads the user's guides, closing anything on screen. Don't call it on every route change or render.

On **logout**, call `LocatifyGuides.reset()`. It forgets the user and starts a new anonymous visitor, so the next person on that browser doesn't inherit their progress.

## Attributes

Attributes are what authors write [user rules](targeting#users) against. Send what's useful for deciding who should see what:

```js
LocatifyGuides.identify(String(user.id), {
  email: user.email,
  name: user.name,
  plan: user.plan,                       // "free" | "pro" | …
  role: user.role,                       // "admin" | "editor" | …
  signedUpAt: user.createdAt,            // ISO date string, e.g. "2026-10-01T09:30:00Z"
  projectCount: user.projects.length,
  locale: user.language,
});
```

- Attributes are **merged**: sending `{ plan: "pro" }` later updates `plan` and keeps the rest. Send `null` to clear one.
- Send dates as ISO 8601 strings so *greater than* / *less than* rules compare them as dates.
- Tell your guide authors which attribute names exist. They can see each person's attributes on the **Users** page.
- Don't send sensitive personal data you don't need for targeting. Attributes are stored on the Locatify Guides server.

## Companies

To group users by company (in [Analytics](analytics#companies)), send the company's id and name as attributes. By default the first of these that's present is used:

| | Attributes looked for, in order |
| --- | --- |
| Company id | `company_id`, `companyId`, `publisher`, `publisher_id`, `organization_id`, `org_id`, `account_id` |
| Company name | `company_name`, `companyName`, `publisher_alias`, `publisher_name`, `organization_name`, `account_name`, `company` |

```js
LocatifyGuides.identify(String(user.id), {
  company_id: String(user.companyId),
  company_name: user.companyName,
});
```

If your attributes have other names, set them under **Settings → Company id attribute / Company name attribute**. Saving regroups everyone the snippet has already seen. A user with only a name is grouped by the name.

The Locatify CMS sends `publisher` and `publisher_alias`, which are picked up automatically.

## Browser, device and language

You don't need to send these. On every page load the snippet reports the browser's language and time zone, and the server reads the browser, operating system and device type (desktop, mobile or tablet) from the user agent. They're shown on **Users** and **Analytics**, and kept up to date with the latest browser each person used. No IP address or location is stored.

## Anonymous visitors

Before `identify()` is called (and without `data-wait-for-identify`), the visitor is anonymous with a random id stored in the browser. They only see guides marked *Also show to anonymous visitors*. When you later identify them, they become a separate, identified user; anonymous progress isn't carried over.

## Order of calls

Calls made before the script loads are queued and replayed in order. Call `identify()` before `track()` so events are attributed to the signed-in user rather than the anonymous visitor.
