
from playwright.sync_api import sync_playwright, expect

def run_verification():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        screenshot_path = "jules-scratch/verification/error_message_validation.png"

        try:
            # 1. Navigate to admin page
            page.goto("http://localhost:3000/admin")

            # 2. Define test data
            test_name = "Sala Duplicada Teste"
            test_url = "http://example.com/duplicate-test.ics"

            # 3. Add the room for the first time
            page.get_by_placeholder("Nome da Sala").fill(test_name)
            page.get_by_placeholder("URL da Agenda (.ics)").fill(test_url)
            page.get_by_role("button", name="Adicionar Sala").click()
            print("Primeira adição (esperado sucesso).")
            # Wait for the room to appear in the list to confirm success
            expect(page.locator(f'li:has-text("{test_name}")')).to_be_visible(timeout=5000)
            print("Sala adicionada à lista.")

            # 4. Try to add the same room again
            page.get_by_placeholder("Nome da Sala").fill(test_name)
            page.get_by_placeholder("URL da Agenda (.ics)").fill(test_url)
            page.get_by_role("button", name="Adicionar Sala").click()
            print("Segunda adição (esperado erro).")

            # 5. Check for the error message
            error_message = page.locator(".error-message")
            expect(error_message).to_be_visible(timeout=5000)
            expect(error_message).to_have_text("URL já cadastrada")
            print("Mensagem de erro exibida corretamente.")

            # 6. Take a screenshot for visual confirmation
            page.screenshot(path=screenshot_path)
            print(f"Captura de tela salva em: {screenshot_path}")

        except Exception as e:
            print(f"Erro durante a verificação: {e}")
            page.screenshot(path="jules-scratch/verification/error_debug.png")
        finally:
            browser.close()

if __name__ == "__main__":
    run_verification()
