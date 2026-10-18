# HTTP API

The browser script talks to two public endpoints. You can call the events endpoint from your own server too, which is the way to tick checklist items for things that happen outside the browser.

All requests are `POST` with a JSON body. Responses are JSON. Errors return `{ "error": "…" }`. The endpoints allow requests from any origin.

## The user object

Both endpoints identify the user the same way:

```json
{ "id": "42", "hash": "…", "attributes": { "plan": "pro" } }
```

| Field | Notes |
| --- | --- |
| `id` | Your user id, as passed to `identify()`. Use `anonymousId` instead for anonymous visitors. |
| `hash` | Required if the workspace requires [identity verification](identity-verification). Always rejected if present but wrong. |
| `attributes` | Optional. Merged into the user's attributes (init only). |

A user who doesn't exist yet is created.

## POST /api/sdk/events

Records up to 50 events for one user.

```bash
curl -X POST https://guides.example.com/api/sdk/events \
  -H "Content-Type: application/json" \
  -d '{
    "key": "pk_…",
    "user": { "id": "42", "hash": "…" },
    "events": [ { "type": "custom", "name": "project_created" } ]
  }'
```

Event fields:

| Field | Notes |
| --- | --- |
| `type` | From a server, use `custom`. The script also sends `guide_shown`, `step_viewed`, `guide_completed`, `guide_dismissed`, `checklist_item_completed` and `hotspot_opened`, which need a `guideId`. |
| `name` | The event name for `custom` events (up to 191 characters). |
| `guideId`, `stepIndex`, `url` | Optional context, used by the script. |

The response lists the guides whose progress changed, e.g. a checklist item ticked by the event:

```json
{ "progress": { "cm1abc…": { "status": "STARTED", "currentStep": 0, "completedItems": ["i1", "i2"] } } }
```

## POST /api/sdk/init

Returns the theme and the published guides this user may see, with their progress. The script calls it on every page load; you'd only call it yourself to debug targeting.

```json
{ "key": "pk_…", "user": { "id": "42" }, "url": "https://app.example.com/dashboard" }
```

## Errors

| Status | Meaning |
| --- | --- |
| 400 | The body is missing fields or has wrong types. |
| 401 | The hash is wrong, or missing while verification is required. |
| 404 | No workspace has that key. |
