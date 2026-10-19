# Introduction

User Onboarder shows onboarding content inside your website or web app: product tours, checklists, announcements, hotspots, surveys and a resource center. You build guides in the dashboard, point them at parts of your app with the visual builder, and decide who sees them and where. Everything people do with a guide is recorded, so you can see what works.

## Who these docs are for

- **Guide authors** (product, support, customer success) create and publish guides. No coding needed. Start with the [Quick start](quick-start), then [Product tours](tours) and [The visual builder](builder).
- **Developers** add one snippet to the site and tell User Onboarder who is signed in. Start with [Install the snippet](install) and [Identify users](identify).

## The building blocks

| Term | What it means |
| --- | --- |
| **Workspace** | One website or app. It has its own snippet, guides, users, analytics and team. You can belong to several workspaces. |
| **Guide** | One piece of onboarding content. There are four types (below). |
| **Snippet** | A small script tag your developers add to every page. It loads the guides and reports what users do. |
| **User** | A person using *your* app (not a dashboard member). Identified users have the id your app gives them; anonymous visitors get a random id. |
| **Draft / live** | Every guide has a draft that you edit and a live version that users see. *Publish* copies the draft to the live version. |
| **Targeting** | Rules for which pages and which users a guide appears for, and how often. |

## Guide types

| Type | Looks like | Good for |
| --- | --- | --- |
| [Product tour](tours) | A series of tooltips, each pointing at an element, or centered modals | Walking new users through a workflow |
| [Checklist](checklists) | A launcher button in the corner that opens a task list with a progress bar | Onboarding goals that take several sessions |
| [Announcement](announcements) | A centered modal or a banner across the top | Release news, maintenance notices |
| [Hotspots](hotspots) | Pulsing dots on elements; clicking one shows a hint | Pointing out features without interrupting |
| [Survey](surveys) | A card in the corner (or a modal) asking one question at a time | NPS, feedback, research |
| [Resource center](resource-center) | A help button that opens a panel with search, guides, a checklist, articles, links and contact | Self-serve help people can come back to |

## How a guide reaches a user

1. A user opens a page of your app. The snippet loads and asks the server which live guides this user may see.
2. The server checks the guide's user rules (plan, role, sign-up date…) and the user's history (already completed? dismissed?).
3. In the browser, the snippet checks the page rules against the current address, then shows the guide. Only one tour, announcement or survey is on screen at a time; checklists, hotspots and the resource center launcher can appear alongside.
4. Views, steps, completions and dismissals are sent back and show up in [Analytics](analytics).
