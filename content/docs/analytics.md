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

Steps and items are labelled using the live version of the guide.

## Users

**Users** lists everyone the snippet has seen, most recent first. Search by the id your app uses. Open a person to see:

- their **attributes** (what targeting rules test against),
- each **guide** they've met and its state: started, completed or dismissed,
- their latest **activity**: guides seen, steps, completions and tracked events.

This is the fastest way to answer "why didn't Anna see the tour?". Check her attributes against the guide's user rules, and whether she already dismissed it.
