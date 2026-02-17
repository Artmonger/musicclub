# If you see no change after deploy

## 1. Check which commit is live

Open in your browser:

**https://musicclub-rr8x.vercel.app/api/deploy-info**

- If **commit** is **8054ad9** (or newer), the new code is deployed.
- If **commit** is older or **null**, production is still serving an old build.

## 2. Make the new build live in Vercel

1. Go to **vercel.com** → your project **musicclub-rr8x**.
2. Open the **Deployments** tab.
3. Find the **latest** deployment (top of the list) with commit **8054ad9** or the latest message.
4. If it is **not** the one marked "Production", click the **⋯** menu on that deployment → **Promote to Production** (or **Set as Production**).
5. Wait for it to finish; the production URL will then serve that build.

## 3. Hard refresh your browser

- **Mac:** Cmd + Shift + R (or Cmd + Option + R in Safari).
- **Windows/Linux:** Ctrl + Shift + R.

Or open the site in an **Incognito/Private** window so cache is not used.

## 4. What you should see with the new build

- A **"Refresh from backend"** button next to the project title (with a light border/background).
- After uploading a file, **refreshing the page** or clicking **Refresh from backend** shows the new track (UI matches Supabase).

If deploy-info shows the right commit and you hard-refresh but still don’t see the button, try another browser or device to rule out cache.
