# Analytics

All numbers count **people**, not clicks or page loads. Someone who sees a tour on five different days counts once. Dates are in UTC.

## Overview

The workspace's **Overview** page covers the last 30 days:

| Figure | Meaning |
| --- | --- |
| **Active users** | People the snippet saw in the period; *identified* are those your app identified. |
| **All-time users** | Everyone the snippet has ever seen. |
| **Live guides** | Guides that are published now. |
| **Completion rate** | Completions divided by views, summed over all guides. |

The **Daily guide reach** chart shows, per day, how many people saw any guide and how many completed one. Hover for exact numbers, or choose **Table** to see them as a list.

The table below lists every guide with how many people saw, completed and dismissed it.

## A single guide

Open **Analytics** from a guide's editor, and pick 7, 30 or 90 days at the top right.

- **Saw it**: people who were shown the guide.
- **Completed**: finished a tour, pressed the announcement's button, ticked every checklist item, or opened every hotspot.
- **Dismissed**: closed it with ×, Esc, or *Dismiss checklist*.

A low completion rate with few dismissals usually means people left the page mid-guide. A high dismissal rate means the guide is in the way: show it later (delay), to fewer people (targeting), or make it shorter.

Below the chart, each guide type gets its own breakdown:

| Guide | Breakdown |
| --- | --- |
| Product tour | **Step funnel**: how many people reached each step, as a share of those who reached step 1. The step after a big drop is the one to fix. |
| Checklist | **Items completed**: how many people did each item, as a share of those who saw the checklist. |
| Hotspots | **Hotspots opened**: how many people opened each hotspot. |
| Survey | **Question funnel**, then the answers to every question. See [Surveys](surveys#results). |

Steps and items are labelled using the live version of the guide.

## Users and companies

The **Analytics** page is about the people using your site rather than single guides. Pick 7, 30 or 90 days at the top right.

| Figure | Meaning |
| --- | --- |
| **All users** | Everyone the snippet has seen. |
| **New** | People seen for the first time in the chosen period. |
| **Active today** | People who loaded a page with the snippet today (UTC). |
| **Weekly active** | Seen in the last 7 days. |
| **Monthly active** | Seen in the last 30 days. **Stickiness** is the average daily actives over the last week divided by monthly actives: how many of your monthly users come back on a typical day. |
| **Inactive** | Not seen for 30 days or more. |

Click a figure to open the matching list on **Users**.

- **Active users** chart: for each day, the daily, weekly (7 days up to that day) and monthly (30 days up to that day) active users. A rising daily line with a flat monthly line means the same people come more often; a rising monthly line means more people overall.
- **New users per day**.
- **Browser, Operating system, Device, Language**: how the people active in the period split. Click a value to list those users. *Other / unknown* folds the rarer values together with people whose details aren't known yet (users last seen before this was recorded).
- **Most active companies**: see below.

"Active" means the snippet loaded on a page for that person, whether or not they saw a guide.

### Companies

Users are grouped into **companies** (in the Locatify CMS: publishers) using attributes your app sends with [identify()](identify#companies). The **Companies** page lists each company with its users, new users in the last 7 days, weekly and monthly actives, inactive users, guides completed and when someone from it was last seen. Sort by size, activity or most recent, search by name or id, and click any number to list those users.

### Users

**Users** lists everyone the snippet has seen, most recent first, with their company, browser, operating system, device and language.

- **Tabs** split the list into *All*, *New*, *Weekly active*, *Monthly active* and *Inactive*, with a count on each.
- **Filters** narrow it to one company, browser, operating system, device or language. Choose *No … / unknown* to find users without one.
- **Search** matches the user id or the company.
- **Export CSV** downloads the filtered list, including attributes.

Open a person to see:

- their **details**: company, browser, operating system, device, language, time zone and how many days they were active in the last 30,
- their **attributes** (what targeting rules test against),
- their **survey answers**,
- each **guide** they've met and its state: started, completed or dismissed,
- their latest **activity**: guides seen, steps, completions and tracked events.

This is the fastest way to answer "why didn't Anna see the tour?". Check her attributes against the guide's user rules, and whether she already dismissed it.
