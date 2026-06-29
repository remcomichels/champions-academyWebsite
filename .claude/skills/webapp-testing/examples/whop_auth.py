from playwright.sync_api import sync_playwright

# Example: Testing a Whop-authenticated Next.js dashboard page
#
# Your Whop app requires the x-whop-user-token header to identify the current user.
# In production this is injected by Whop's proxy — in tests you must set it manually.
#
# How to get a test token:
#   1. Run your app locally with `npm run dev`
#   2. Open it in your browser and log in via Whop
#   3. Open DevTools → Application → Cookies
#   4. Copy the value of `whop_user_token`

TEST_JWT = "YOUR_TEST_JWT_TOKEN"  # Replace with token from browser cookies
COMPANY_ID = "biz_xxxxxxxx"       # Replace with your company ID

console_errors = []

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1280, "height": 900})

    # Capture any console errors during the test
    def handle_console(msg):
        if msg.type == "error":
            console_errors.append(msg.text)

    page.on("console", handle_console)

    # ✅ Inject Whop auth header BEFORE navigating
    page.set_extra_http_headers({
        "x-whop-user-token": TEST_JWT
    })

    # Navigate to your dashboard
    page.goto(f'http://localhost:3000/dashboard/{COMPANY_ID}')
    page.wait_for_load_state('networkidle')

    # Take a screenshot to visually verify the page loaded correctly
    page.screenshot(path='/tmp/dashboard_authenticated.png', full_page=True)
    print("Screenshot saved: /tmp/dashboard_authenticated.png")

    # Check that key UI elements are present (adjust selectors to your app)
    assert page.locator('text=Members').count() > 0, "Members section not found"
    print("✅ Members section loaded")

    # --- Test unauthenticated state ---
    # Open a fresh page WITHOUT the header to verify the fallback UI
    unauth_page = browser.new_page()
    unauth_page.goto(f'http://localhost:3000/dashboard/{COMPANY_ID}')
    unauth_page.wait_for_load_state('networkidle')
    unauth_page.screenshot(path='/tmp/dashboard_unauthenticated.png', full_page=True)
    print("Screenshot saved: /tmp/dashboard_unauthenticated.png")

    browser.close()

# Report any JS errors that occurred
if console_errors:
    print(f"\n⚠️  {len(console_errors)} console error(s) detected:")
    for err in console_errors:
        print(f"  - {err}")
else:
    print("\n✅ No console errors detected")
