from playwright.sync_api import sync_playwright, expect
import requests

def run_verification():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        try:
            # 1. Navegar para a página de administração
            page.goto("http://localhost:3000/admin", timeout=120000)

            # 2. Adicionar uma nova agenda com nome personalizado
            test_nome = "Calendário de Teste"
            test_url = "https://outlook.office365.com/owa/calendar/7a46717008cd460da28337c24dfd5cc8@comolatti.com.br/f6037c9a622644d886bf91c7f44c2ad612452086806111119360/calendar.ics"

            page.locator('input[placeholder="Nome da Sala"]').fill(test_nome)
            page.locator('input[placeholder="URL da Agenda Pública (.ics)"]').fill(test_url)
            page.get_by_role("button", name="Adicionar").click()

            # 3. Esperar a mensagem de sucesso
            expect(page.locator(".success-message")).to_have_text("Agenda adicionada com sucesso!", timeout=30000)

            # 4. Navegar para a página do dashboard
            page.goto("http://localhost:3000/", timeout=120000)

            # 5. Verificar se a nova agenda está presente com o nome correto
            new_agenda_item = page.locator(f"//div[contains(text(), '{test_nome}')]")
            expect(new_agenda_item).to_be_visible(timeout=30000)

            # 6. Verificar se há células de status 'ocupado' ou 'livre'
            expect(page.locator(".status-livre, .status-ocupado")).not_to_have_count(0, timeout=30000)

            # 7. Tirar a captura de tela do dashboard
            page.screenshot(path="jules-scratch/verification/dashboard_final_final.png")
            print("Verificação do frontend concluída com sucesso. Captura de tela salva.")

        except Exception as e:
            print(f"Ocorreu um erro durante a verificação do frontend: {e}")
            page.screenshot(path="jules-scratch/verification/error.png")

        finally:
            # Remover a agenda adicionada para limpar o estado
            requests.delete(f"http://localhost:8000/agendas/{requests.utils.quote(test_url)}")

            browser.close()

if __name__ == "__main__":
    run_verification()
