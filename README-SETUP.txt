RANKWISE ADMIN PANEL + SEO CMS — NETLIFY SETUP
================================================

What this upgrade adds
----------------------
- Owner-only admin login at /admin/ (public SEO tools still need no login).
- Create, edit, publish, draft and delete custom content pages.
- Edit each page's URL slug, SEO title, meta description, focus keyword note, canonical URL, social image, index/noindex state, H1, intro, body and CTA.
- Edit homepage hero copy, feature cards, trust statement and CTA text.
- Separate public URLs for /serp-checker/ and /keyword-explorer/ with their own HTML title and metadata.
- Generated canonical tags, robots.txt, sitemap.xml, basic WebPage/WebSite structured data, and old-slug redirects when you change URLs.
- Content saves to GitHub with a server-side token. A GitHub commit triggers Netlify to rebuild the static pages.
- SerpApi key stays in Netlify server environment variables, not in the browser.

Before doing anything
---------------------
1. Keep your existing SERPAPI_KEY variable in Netlify. Do not delete it.
2. Never put a real API key, GitHub token or admin password in an HTML file or GitHub source file.
3. The admin content API needs a GitHub fine-grained personal access token stored as the Netlify secret GITHUB_TOKEN. The token must be allowed to write repository contents for only shahrozahmed789/rankwise.

How to install this upgrade into your existing GitHub Desktop repository
--------------------------------------------------------------------------
1. Download and extract the ZIP file.
2. Open GitHub Desktop > your existing rankwise repository > Repository > Show in Explorer.
3. Keep a backup of the local repository folder first (copy it to another folder).
4. Open the extracted rankwise_cms folder. Copy everything INSIDE it into the existing rankwise repository folder. Do not copy the outer rankwise_cms folder as a nested folder.
5. When Windows asks to replace existing files, allow replacement for files such as netlify.toml and public/index.html. New folders/files such as src, scripts, content, admin functions and package.json should also be copied.
6. Verify the root of the existing rankwise repository contains at least:
   - netlify.toml
   - package.json
   - scripts/build.mjs
   - src/index.html
   - src/admin.html
   - content/pages.json
   - public/index.html
   - netlify/functions/serp.mjs
   - netlify/functions/keywords.mjs
   - netlify/functions/admin-auth.mjs
   - netlify/functions/admin-content.mjs
7. GitHub Desktop should show modified/new files. Summary: "Add Rankwise admin CMS". Click Commit to main, then Push origin.
8. Netlify should begin a new deploy. Wait for Published and check Deploy log if it fails.

Netlify build configuration
---------------------------
The included netlify.toml sets:
- Build command: node scripts/build.mjs
- Publish directory: public
- Functions directory: netlify/functions
Do not change the publish directory to the repository root.

Create the required secure secrets in Netlify
---------------------------------------------
Open Netlify > rankwisepure > Project configuration > Environment variables.
Add these three new variables. Leave "Contains secret values" enabled. The values should be available to Functions (and builds if the scope choices ask for it). If Netlify shows different fields for Production, Deploy Previews and Branch deploys, paste the same value in all three contexts.

A) ADMIN_PASSWORD
- This is the password you will type at /admin/.
- Make your own strong, unique password at least 16 characters long.
- Do not use your SerpApi key or GitHub password.

B) ADMIN_SESSION_SECRET
- This signs short-lived admin sessions; it must be a random secret of at least 32 characters.
- Use a password manager's random password generator to create one. Prefer 64 random characters.
- Save it in your password manager. Do not put it in this repository or send it in chat.

C) GITHUB_TOKEN
- Create a GitHub fine-grained personal access token.
- Set Resource owner to your GitHub account (shahrozahmed789).
- Choose Only select repositories > rankwise.
- Under Repository permissions, set Contents = Read and write; Metadata read is normally included automatically.
- Create the token and copy it once. Store it directly as the Netlify environment variable GITHUB_TOKEN. Never paste it into this chat or into any repo file.

You already configured SERPAPI_KEY for live search; keep it as-is.

After saving environment variables
----------------------------------
1. Go to Deploys and trigger a new production deploy, or push a harmless repository commit.
2. Wait until Published.
3. Open https://rankwisepure.netlify.app/admin/.
4. Enter the ADMIN_PASSWORD you created above and sign in.
5. Select Home, SERP Checker or Keyword Explorer in the left panel. Edit the fields and click Save & publish.
6. The admin function will update content/pages.json in GitHub. Netlify should detect that new commit and rebuild; custom pages/SEO tags/sitemap become public after the deployment finishes.
7. If the admin login page says ADMIN_SETUP_REQUIRED, ADMIN_PASSWORD or ADMIN_SESSION_SECRET is missing/not visible to the functions.
8. If it says GITHUB_TOKEN_MISSING, check the GITHUB_TOKEN variable and redeploy.
9. If GitHub says 403, the token permissions or repository selection are incorrect. Never share the token; change the Netlify secret instead.

Editing and SEO behavior
------------------------
- Home URL is always /. Tool/content pages have editable slugs such as /serp-checker/ or /about-us/.
- If you change a page slug, the backend records the previous slug and the next build emits a 301 redirect when possible.
- Draft pages are not generated as public pages or included in the sitemap.
- Pages marked noindex are omitted from the sitemap and get a noindex robots meta tag.
- The "focus keyword" field is an editorial note; Google does not use the meta keywords tag as a ranking shortcut. Write naturally useful content.
- Meta title and description are generated into each page's real HTML during the build, rather than only being changed in browser JavaScript.
- Custom pages use plain text with one paragraph per line, which is HTML-escaped for safety. The fields do not accept scripts or arbitrary HTML.
- This panel does not let editors inject HTML/JavaScript, upload media assets or edit tool API code.

Using your own domain later
---------------------------
1. In Netlify Project overview > Domain management, add a domain you own and follow Netlify's DNS instructions. A paid .com domain is not included with free hosting.
2. Wait for Netlify to issue HTTPS and confirm the domain works.
3. In /admin/, edit the Website base URL to the final https://yourdomain.com address, then Save & publish. This updates canonicals and sitemap URLs.
4. Keep the Netlify URL as a fallback.

Security notes
--------------
- Public visitors do not need login, but /admin/ does require a password.
- The GitHub token and admin password exist only in Netlify environment variables and are used by serverless functions.
- Because this public website calls a limited SerpApi plan, add rate limiting/abuse controls before promoting it widely. Never expose GITHUB_TOKEN or ADMIN_SESSION_SECRET.
