from playwright.sync_api import sync_playwright, expect

def run_verification():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        try:
            # 1. Navegar para a página de administração com timeout maior
            page.goto("http://localhost:3000/admin", timeout=60000)

            # 2. Esperar pelo campo de entrada
            input_field = page.locator('input[type="text"]')
            expect(input_field).to_be_visible(timeout=10000)

            # 3. Adicionar uma nova agenda
            test_url = "local"
            input_field.fill(test_url)
            page.get_by_role("button", name="Adicionar").click()

            # 4. Esperar a mensagem de sucesso
            expect(page.locator(".success-message")).to_have_text("Agenda adicionada com sucesso!", timeout=10000)

            # 5. Navegar para a página do dashboard
            page.goto("http://localhost:3000/", timeout=60000)

            # 6. Esperar a grade de agendamento carregar
            schedule_grid = page.locator(".schedule-grid")
            expect(schedule_grid).to_be_visible(timeout=10000)

            # 7. Verificar se a nova agenda está presente
            expect(schedule_grid.locator(".grid-row")).to_have_count(1)

            # 8. Tirar a captura de tela
            page.screenshot(path="jules-scratch/verification/verification.png")
            print("Verificação do frontend concluída com sucesso. Captura de tela salva.")

        except Exception as e:
            print(f"Ocorreu um erro durante a verificação do frontend: {e}")
            page.screenshot(path="jules-scratch/verification/error.png")

        finally:
            browser.close()

if __name__ == "__main__":
    run_verification()
