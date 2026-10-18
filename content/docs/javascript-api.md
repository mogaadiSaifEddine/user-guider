# JavaScript API

All methods live on `window.LocatifyGuides`. They can be called before the script has loaded; calls are queued and run in order once it does. None of them return a value or throw.

## identify(userId, attributes?, options?)

Sets the signed-in user and reloads their guides. See [Identify users](identify).

```js
LocatifyGuides.identify("42", { plan: "pro" }, { hash: "…" });
```

## track(name)

Records a named event for the current user, e.g. something they did in your app. Checklist items set to *Done when: An event is tracked* with the same name are ticked, and the checklist on screen updates within about a second.

```js
LocatifyGuides.track("project_created");
```

- Names are case-sensitive, up to 191 characters. Agree on them with your guide authors; `snake_case` verbs in the past tense work well.
- Events are sent in small batches (within about a second), and any still waiting are sent when the page is closed.
- To record events that happen on your server (a payment, an import finishing), use the [HTTP API](http-api).

## start(guideId)

Starts a tour or announcement immediately, from step 1. The guide id is shown in the editor under **Manual start**.

```js
document.querySelector("#help-tour").addEventListener("click", () => {
  LocatifyGuides.start("cm1abc…");
});
```

- The guide must be published and the user must match its user rules (and, if anonymous, the guide must allow anonymous visitors). Otherwise a warning is logged to the console and nothing happens.
- Page rules, frequency and delay are ignored.
- Anything already on screen (another tour or announcement) is closed first.
- Checklists and hotspots can't be started this way; they appear on their own.

## page()

Checks page rules again right now. Address changes made with `history.pushState`, `replaceState`, back/forward and hash changes are detected automatically, so you rarely need this, only if your router changes what's on screen without changing the address.

```js
LocatifyGuides.page();
```

## reset()

Forgets the current user, creates a new anonymous visitor and reloads guides. Call it on logout.

```js
LocatifyGuides.reset();
```

## Builder mode

When the page is opened from the dashboard's **Open builder** button, the address contains `?lg_builder=…`. The script removes that parameter from the address bar, shows the builder instead of live guides, and turns all the methods above into no-ops for that tab until the author exits.
