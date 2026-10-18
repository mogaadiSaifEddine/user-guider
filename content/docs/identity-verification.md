# Identity verification

`identify()` runs in the browser, so anyone can call it with someone else's user id and load that person's guide progress and attributes into their own browser. Identity verification closes that gap: your server signs each user id with a secret only it knows, and the Locatify Guides server checks the signature.

## How it works

1. The workspace has a **secret key** (Settings → Keys, owners only).
2. Your server computes `HMAC-SHA256(secretKey, userId)` as lowercase hex and puts it in the page.
3. The browser passes it to `identify()`:

```js
LocatifyGuides.identify(user.id, { plan: user.plan }, { hash: "{{ user_hash }}" });
```

The id you sign must be exactly the string you pass to `identify()`.

## Compute the hash

**Node.js**

```js
import { createHmac } from "crypto";

const hash = createHmac("sha256", process.env.LOCATIFY_GUIDES_SECRET)
  .update(String(user.id))
  .digest("hex");
```

**Python / Django**

```python
import hashlib, hmac

user_hash = hmac.new(
    settings.LOCATIFY_GUIDES_SECRET.encode(),
    str(user.id).encode(),
    hashlib.sha256,
).hexdigest()
```

**PHP**

```php
$hash = hash_hmac('sha256', (string) $user->id, getenv('LOCATIFY_GUIDES_SECRET'));
```

For a single-page app, return the hash from the endpoint that returns the current user (e.g. `/api/me`), next to the user's id.

## Roll it out

1. Ship the code that sends `hash` with every `identify()` call. Verification isn't enforced yet, so nothing breaks while you deploy, **but a wrong hash is always rejected**. Test before you ship.
2. Check that guides still load for signed-in users.
3. In **Settings**, tick **Require identity verification**. From now on, `identify()` without a valid hash is refused and that user sees no guides.

Anonymous visitors aren't affected.

## Keep the secret safe

- Store it like a password: environment variable or secret manager, never in front-end code or a public repository.
- If it leaks, an owner can **Rotate** it in Settings. Users stop loading guides until your server uses the new secret, so update the server right after rotating.
