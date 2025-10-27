from playwright.sync_api import sync_playwright, expect

def run(playwright):
    browser = playwright.chromium.launch()
    page = browser.new_page()

    # 1. Go to Admin page and take a screenshot
    page.goto("http://localhost:3000/admin")
    expect(page.get_by_role("heading", name="Administração de Salas")).to_be_visible()
    page.screenshot(path="jules-scratch/verification/admin_page_empty.png")

    # 2. Add a new room
    page.get_by_placeholder("Nome da Sala").fill("Sala de Testes")
    page.get_by_placeholder("URL da Agenda (.ics)").fill("https://example.com/calendar.ics")
    page.get_by_role("button", name="Adicionar Sala").click()

    # Wait for the new room to appear in the list
    expect(page.get_by_text("Sala de Testes (https://example.com/calendar.ics)")).to_be_visible()
    page.screenshot(path="jules-scratch/verification/admin_page_with_room.png")

    # 3. Go to Dashboard page and take a screenshot
    page.get_by_role("link", name="Visualização").click()
    expect(page.get_by_text("SALA DE TESTES")).to_be_visible()
    page.screenshot(path="jules-scratch/verification/dashboard_page.png")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)
