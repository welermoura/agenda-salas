from playwright.sync_api import sync_playwright

def run(playwright):
    browser = playwright.chromium.launch()
    page = browser.new_page()
    page.goto("http://localhost:3000/")
    page.screenshot(path="jules-scratch/verification/verification_home.png")
    page.get_by_role("link", name="Gerenciar Usuários").click()
    page.wait_for_url("http://localhost:3000/users")
    page.screenshot(path="jules-scratch/verification/verification_users.png")
    page.get_by_role("link", name="Gerenciar Grupos").click()
    page.wait_for_url("http://localhost:3000/groups")
    page.screenshot(path="jules-scratch/verification/verification_groups.png")
    browser.close()

with sync_playwright() as playwright:
    run(playwright)
