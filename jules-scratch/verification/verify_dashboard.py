from playwright.sync_api import sync_playwright

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        page.goto("http://localhost:3000")
        page.wait_for_selector(".schedule-grid")
        page.screenshot(path="jules-scratch/verification/dashboard.png")
        browser.close()

run()
