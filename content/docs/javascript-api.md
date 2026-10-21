# JavaScript API

All methods live on `window.UserOnboarder`. They can be called before the script has loaded; calls are queued and run in order once it does. None of them throw, and only `getLocale()` returns a value.

## identify(userId, attributes?, options?)

Sets the signed-in user and reloads their guides. See [Identify users](identify).

```js
UserOnboarder.identify("42", { plan: "pro" }, { hash: "…" });
```

## track(name)

Records a named event for the current user, e.g. something they did in your app. Checklist items set to *Done when: An event is tracked* with the same name are ticked, and the checklist on screen updates within about a second. A tour step set to *Advance on: An event from your app* with the same name moves on right away.

```js
UserOnboarder.track("project_created");
```

- Names are case-sensitive, up to 191 characters. Agree on them with your guide authors; `snake_case` verbs in the past tense work well.
- Events are sent in small batches (within about a second), and any still waiting are sent when the page is closed.
- To record events that happen on your server (a payment, an import finishing), use the [HTTP API](http-api).

## start(guideId)

Starts a tour, announcement or survey immediately, from step 1. The guide id is shown in the editor under **Manual start**.

```js
document.querySelector("#help-tour").addEventListener("click", () => {
  UserOnboarder.start("cm1abc…");
});
```

- The guide must be published and the user must match its user rules (and, if anonymous, the guide must allow anonymous visitors). Otherwise a warning is logged to the console and nothing happens.
- Page rules, frequency and delay are ignored.
- Anything already on screen (another tour, announcement or survey) is closed first.
- Checklists and hotspots can't be started this way; they appear on their own. Passing a resource center's id opens its panel, like `openResourceCenter()`.

## openResourceCenter()

Opens the [resource center](resource-center) panel, e.g. from a *Help* item in your own menu. Works whether or not the resource center shows its launcher button. Called before the snippet has loaded, the panel opens as soon as it's ready; if no resource center matches this page and user, a warning is logged to the console.

```js
document.querySelector("#help-menu").addEventListener("click", () => {
  UserOnboarder.openResourceCenter();
});
```

## closeResourceCenter()

Closes the resource center panel if it's open.

## setLocale(locale)

Shows guides in another language, for example right after the user switches language in your app. Pass a language code like `"de"` or `"pt-BR"`; guides on screen are closed and reloaded in that language. An empty string goes back to automatic detection. See [Languages and translation](localization#which-language-a-user-sees) for how the language is picked otherwise.

```js
UserOnboarder.setLocale("is");
```

## getLocale()

Returns the language guides are currently shown in: one of your workspace's languages, or `"en"`. Unlike the other methods it returns a value, so call it only after the script has loaded.

## page()

Checks page rules again right now. Address changes made with `history.pushState`, `replaceState`, back/forward and hash changes are detected automatically, so you rarely need this, only if your router changes what's on screen without changing the address.

```js
UserOnboarder.page();
```

## reset()

Forgets the current user, creates a new anonymous visitor and reloads guides. Call it on logout.

```js
UserOnboarder.reset();
```

## Builder mode

When the page is opened from the dashboard's **Open builder** button, the address contains `?lg_builder=…`. The script removes that parameter from the address bar, shows the builder instead of live guides, and turns all the methods above into no-ops for that tab until the author exits.
