# Workspace, team and theme

Everything here is under **Settings** in the dashboard sidebar.

## Appearance

Guides use your workspace theme so they match your app:

| Setting | Used for |
| --- | --- |
| **Primary color** | Buttons, highlight outline, hotspot dots, checklist launcher and progress, banner background |
| **Text color** | Text in tooltips, modals and the checklist |
| **Background** | Tooltips, modals and the checklist panel |
| **Corner radius** | Rounding of cards and buttons (0–24 px) |
| **Font** | Font family, e.g. `Inter, sans-serif`. `inherit` uses the system font. The font must already be loaded by your app. |

The preview card shows the result. Changes apply on the next page load once saved.

## Team

Members can edit every guide in the workspace. There are two roles:

| Role | Can |
| --- | --- |
| **Editor** | Create, edit, publish and delete guides; see analytics, users and the install page. |
| **Owner** | Everything an editor can, plus manage members, see and rotate keys, and delete the workspace. |

To add someone, they first need an account (they sign up themselves); then an owner adds them by email under **Team**. A workspace always keeps at least one owner.

## Keys

| Key | Where it goes | If you rotate it |
| --- | --- | --- |
| **Public key** | In the snippet on your site (`data-key`). Not secret. | Guides stop loading until the snippet uses the new key. |
| **Secret key** | Only on your server, for [identity verification](identity-verification). Owners only. Never put it in browser code. | Users stop loading guides until your server signs with the new key, if verification is required. |

## Require identity verification

When ticked, the server rejects users whose identity isn't signed with the secret key. Turn it on only after your developers have shipped [identity verification](identity-verification); otherwise identified users stop seeing guides.

## Delete the workspace

**Delete workspace** removes every guide, user, event and member of the workspace. Type the workspace name to confirm. This can't be undone.
