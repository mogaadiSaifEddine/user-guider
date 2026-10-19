# Install the snippet

The snippet is two script tags. The first defines a small queue so your code can call `LocatifyGuides` before the real script has loaded; the second loads the script asynchronously, so it never blocks your page.

## Get your snippet

The dashboard's **Install** page shows the snippet with your workspace's key and server address already filled in. It looks like this:

```html
<script>
  window.LocatifyGuides = window.LocatifyGuides || { q: [] };
  ["identify", "track", "start", "page", "reset", "setLocale", "openResourceCenter", "closeResourceCenter"].forEach(function (m) {
    LocatifyGuides[m] = LocatifyGuides[m] || function () { LocatifyGuides.q.push([m, arguments]); };
  });
</script>
<script async src="https://guides.example.com/sdk.js" data-key="pk_…" data-wait-for-identify></script>
```

Put it in the `<head>` of every page, then [identify signed-in users](identify).

## Script tag attributes

| Attribute | Required | Meaning |
| --- | --- | --- |
| `data-key` | yes | The workspace's public key. Identifies which workspace's guides to load. It isn't secret. |
| `data-wait-for-identify` | no | Show nothing until `identify()` is called. Use it on apps where everyone is signed in, so guides never flash for an anonymous visitor first. Remove it on pages where you want to reach anonymous visitors. |
| `data-locale` | no | The language to show guides in, e.g. `de`. Without it the language comes from the user's attributes, `<html lang>` or the browser. See [Languages and translation](localization). |
| `data-api` | no | Address of the User Onboarder server, if it differs from where `sdk.js` is served (for example when you host `sdk.js` on your own CDN). |

## Framework notes

### Angular

Add the snippet to `src/index.html`. Calls from components and services go through `window`; declare it once so TypeScript knows about it:

```ts
// src/locatify-guides.d.ts
type LGValue = string | number | boolean | null;
interface Window {
  LocatifyGuides: {
    identify(id: string, attributes?: Record<string, LGValue>, options?: { hash?: string }): void;
    track(name: string): void;
    start(guideId: string): void;
    page(): void;
    reset(): void;
  };
}
```

Then, for example in your auth service after login:

```ts
window.LocatifyGuides.identify(String(user.id), { plan: user.plan, role: user.role });
```

Angular's router changes the address with `history.pushState`, which the script detects on its own.

### React / Next.js

In Next.js (App Router), add the tags to the root layout with `next/script`:

```tsx
import Script from "next/script";

<Script id="lg-stub" strategy="beforeInteractive">{`
  window.LocatifyGuides = window.LocatifyGuides || { q: [] };
  ["identify","track","start","page","reset","setLocale","openResourceCenter","closeResourceCenter"].forEach(function (m) {
    LocatifyGuides[m] = LocatifyGuides[m] || function () { LocatifyGuides.q.push([m, arguments]); };
  });
`}</Script>
<Script src="https://guides.example.com/sdk.js" data-key="pk_…" data-wait-for-identify strategy="afterInteractive" />
```

Call `window.LocatifyGuides.identify(...)` in an effect once the session is known.

### Server-rendered sites

Add the snippet to your base template. Identify the user in an inline script rendered on pages where they're signed in.

## Check that it works

1. Open your site. In the browser's developer tools, the network tab should show `sdk.js` and a request to `/api/sdk/init` with status 200.
2. The **Install** page in the dashboard shows **Receiving data**, and people appear under **Users**.
3. Problems are logged to the browser console with the prefix `[LocatifyGuides]`. See [Troubleshooting](troubleshooting).

## Content Security Policy

If your site sends a `Content-Security-Policy` header, allow the User Onboarder server:

| Directive | Add | Why |
| --- | --- | --- |
| `script-src` | your User Onboarder address, plus a nonce or hash for the inline stub | loading `sdk.js` and the queue |
| `connect-src` | your User Onboarder address | loading guides and sending events |
| `style-src` | `'unsafe-inline'` | the script styles its own elements |
| `img-src` | your User Onboarder address, plus any other image hosts you link to | images in steps and announcements (uploads are served from User Onboarder) |
| `frame-src` | `https://www.youtube-nocookie.com https://player.vimeo.com` | video blocks |

## What the script adds to your page

Everything is drawn inside one `<locatify-guides>` element attached to `<html>`, using a shadow root, so your CSS doesn't affect guides and guide CSS doesn't affect your page. It sits at z-index 2147483000. The script stores one value in `localStorage` (`lg_anon_id`, the anonymous visitor id) and, only in builder mode, one value in `sessionStorage`. It sets no cookies.
