---
name: webapp-testing
description: Toolkit for interacting with and testing local Next.js web applications using Playwright. Supports verifying frontend functionality, debugging UI behavior, capturing browser screenshots, and viewing browser logs. Includes patterns for testing Whop-authenticated apps.
license: Complete terms in LICENSE.txt
---

# Web Application Testing

To test local web applications, write native Python Playwright scripts.

**Helper Scripts Available**:
- `scripts/with_server.py` - Manages server lifecycle (supports multiple servers)

**Always run scripts with `--help` first** to see usage. DO NOT read the source until you try running the script first and find that a customized solution is absolutely necessary. These scripts can be very large and thus pollute your context window. They exist to be called directly as black-box scripts rather than ingested into your context window.

## Decision Tree: Choosing Your Approach

```
User task → Is it static HTML?
    ├─ Yes → Read HTML file directly to identify selectors
    │         ├─ Success → Write Playwright script using selectors
    │         └─ Fails/Incomplete → Treat as dynamic (below)
    │
    └─ No (dynamic Next.js app) → Is the server already running?
        ├─ No → Run: python scripts/with_server.py --help
        │        Then use the helper + write simplified Playwright script
        │
        └─ Yes → Reconnaissance-then-action:
            1. Inject Whop auth header (if app uses Whop)
            2. Navigate and wait for networkidle
            3. Take screenshot or inspect DOM
            4. Identify selectors from rendered state
            5. Execute actions with discovered selectors
```

## Next.js Defaults

- **Port**: Next.js runs on **`http://localhost:3000`** by default (not 5173)
- **Environment**: Next.js automatically loads `.env.local` when you run `npm run dev`,
  so `WHOP_API_KEY`, `NEXT_PUBLIC_WHOP_APP_ID`, and other secrets are available automatically
  — no extra setup needed for the server command

## Example: Using with_server.py

To start a server, run `--help` first, then use the helper:

**Next.js app (standard):**
```bash
python scripts/with_server.py --server "npm run dev" --port 3000 -- python your_automation.py
```

**Next.js + separate backend:**
```bash
python scripts/with_server.py \
  --server "cd backend && python server.py" --port 8000 \
  --server "npm run dev" --port 3000 \
  -- python your_automation.py
```

To create an automation script, include only Playwright logic (servers are managed automatically):

```python
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)  # Always launch chromium in headless mode
    page = browser.new_page()
    page.goto('http://localhost:3000')           # Next.js default port
    page.wait_for_load_state('networkidle')      # CRITICAL: Wait for JS to execute
    # ... your automation logic
    browser.close()
```

## Whop Authentication

Your Whop app relies on the `x-whop-user-token` JWT header being injected by Whop's experience
proxy in production. When Playwright opens the app directly, this header is missing — meaning
Server Components can't identify the user and protected pages will behave as if no one is logged in.

**Always inject the header before navigating** when testing Whop-authenticated pages:

```python
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()

    # Inject Whop user token so your app can identify the user
    # Get a real token from your browser cookies (whop_user_token) during local dev
    page.set_extra_http_headers({
        "x-whop-user-token": "YOUR_TEST_JWT_TOKEN"
    })

    page.goto('http://localhost:3000/dashboard/biz_xxxxxxxx')
    page.wait_for_load_state('networkidle')

    # Now Server Components will have a valid user context
    page.screenshot(path='/tmp/dashboard.png', full_page=True)
    browser.close()
```

**Where to get a test token**: Copy the `whop_user_token` cookie value from your browser's
DevTools while logged into your app locally.

**Testing unauthenticated state**: Omit `set_extra_http_headers` entirely to verify your app
shows the correct fallback UI when no user is present.

## Reconnaissance-Then-Action Pattern

1. **Inspect rendered DOM**:
   ```python
   page.screenshot(path='/tmp/inspect.png', full_page=True)
   content = page.content()
   page.locator('button').all()
   ```

2. **Identify selectors** from inspection results

3. **Execute actions** using discovered selectors

## Common Pitfalls

❌ **Don't** inspect the DOM before waiting for `networkidle` on dynamic apps
✅ **Do** wait for `page.wait_for_load_state('networkidle')` before inspection

❌ **Don't** navigate to Whop-protected pages without setting the auth header first
✅ **Do** call `page.set_extra_http_headers({"x-whop-user-token": "..."})` before `page.goto()`

❌ **Don't** use port 5173 — that's Vite. Next.js uses port 3000
✅ **Do** use `http://localhost:3000`

## Best Practices

- **Use bundled scripts as black boxes** - Use `--help` to see usage, then invoke directly
- Use `sync_playwright()` for synchronous scripts
- Always close the browser when done
- Use descriptive selectors: `text=`, `role=`, CSS selectors, or IDs
- Add appropriate waits: `page.wait_for_selector()` or `page.wait_for_timeout()`

## Reference Files

- **examples/** - Examples showing common patterns:
  - `element_discovery.py` - Discovering buttons, links, and inputs on a page
  - `static_html_automation.py` - Using file:// URLs for local HTML
  - `console_logging.py` - Capturing console logs during automation
  - `whop_auth.py` - Testing a Whop-authenticated dashboard page
