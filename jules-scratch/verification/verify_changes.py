from playwright.sync_api import sync_playwright, expect

def run_verification():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        try:
            # 1. Navegar para a página do dashboard
            page.goto("http://localhost:3000/", timeout=60000)

            # 2. Verificar se a agenda está presente com o nome correto
            test_nome = "Feriados no Brasil"
            new_agenda_item = page.locator(f"//div[contains(text(), '{test_nome}')]")
            expect(new_agenda_item).to_be_visible(timeout=10000)

            # 3. Verificar se há células de status 'ocupado'
            expect(page.locator(".status-ocupado")).not_to_have_count(0, timeout=10000)

            # 4. Tirar a captura de tela do dashboard
            page.screenshot(path="jules-scratch/verification/dashboard_status_colors.png")
            print("Verificação do frontend concluída com sucesso. Captura de tela salva.")

        except Exception as e:
            print(f"Ocorreu um erro durante a verificação do frontend: {e}")
            page.screenshot(path="jules-scratch/verification/error.png")

        finally:
            browser.close()

if __name__ == "__main__":
    run_verification()
