# Quick start

This takes about ten minutes, and you need someone who can edit your site's HTML for step 2.

## 1. Create an account and a workspace

1. Open the dashboard and choose **Sign up**.
2. Name your workspace after the site it belongs to, for example *Locatify CMS*. You land on the **Install** page.

## 2. Install the snippet

Send the **Install** page to your developer, or follow [Install the snippet](install) yourself. The snippet goes into every page of your app, and signed-in users should be identified with `identify()`.

You'll know it works when the badge at the top of the Install page says **Receiving data** instead of *Waiting for the first visitor*.

## 3. Create a tour

1. Go to **Guides → New guide**, pick **Product tour**, give it a name and choose **Create**.
2. Write the first step: a title and some text. A step without an element appears as a centered welcome modal.
3. In the **Visual builder** box on the right, enter the address of a page of your app, e.g. `https://cms.locatify.com/dashboard`, and choose **Open builder**.
4. Your app opens in a new tab with the builder panel at the bottom left. Choose **+ Add step**, then **Pick element**, and click the button or menu the step should point at. Write its text.
5. Choose **Preview** to try it, then **Save**.

See [The visual builder](builder) for details.

## 4. Decide who sees it

Back in the dashboard (the editor reloads the builder's changes when you return to the tab), open the **Targeting** tab:

- Add a page rule, e.g. *Path starts with* `/dashboard`, so the tour only runs there.
- Leave **Show again** at *Never, once seen through or dismissed* for a one-time welcome tour.

See [Targeting and timing](targeting).

## 5. Publish

Choose **Publish**. The next time a matching user loads a matching page, the tour starts.

To test it as a new user, open your app in a private window. Testing with your own account? Once you've seen or closed the tour it won't come back. Use a different user, or set **Show again** to *On every page load* while testing.

## 6. Watch the numbers

Open **Analytics** from the guide's editor to see how many people saw it, finished it, and at which step they left. See [Analytics](analytics).
