
from playwright.sync_api import sync_playwright
import time

def run_verification():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        debug_screenshot_path = "jules-scratch/verification/debug_dashboard.png"

        try:
            # 1. Navigate to admin and add a room
            page.goto("http://localhost:3000/admin")
            test_name = "Sala de Reunião Alpha"
            test_url = "https://outlook.office365.com/owa/calendar/9052d105058b459487a382c72b834164@unimedvtrp.com.br/9940a049d5c34e0086381b896b02a3a516039538356133406983/calendar.ics"
            page.get_by_placeholder("Nome da Sala").fill(test_name)
            page.get_by_placeholder("URL da Agenda (.ics)").fill(test_url)

            add_button = page.get_by_role("button", name="Adicionar Sala")
            add_button.dispatch_event('click')

            print("Sala de teste adicionada.")

            # Adiciona uma pausa para dar tempo ao backend de processar
            time.sleep(5)

            # 2. Navigate to the dashboard page
            page.goto("http://localhost:3000/")

            # 3. Wait for the grid to be visible with the new room
            page.wait_for_selector(f".room-column:has-text('{test_name}')", timeout=10000)
            print("Dashboard carregada com a nova sala.")

            # 4. Take a screenshot
            page.screenshot(path="jules-scratch/verification/dashboard_view_with_data.png")
            print("Captura de tela da nova dashboard realizada com sucesso.")

        except Exception as e:
            print(f"Erro durante a verificação: {e}")
            page.screenshot(path=debug_screenshot_path)
            print(f"Captura de tela de depuração salva em: {debug_screenshot_path}")
        finally:
            browser.close()

if __name__ == "__main__":
    run_verification()
