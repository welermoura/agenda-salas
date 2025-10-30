from playwright.sync_api import sync_playwright, expect
import time

def run_verification():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        try:
            # 1. Verificar o novo layout do Dashboard
            page.goto("http://localhost:3000")
            time.sleep(2) # Espera estática para a página carregar (simples mas eficaz)
            page.screenshot(path="jules-scratch/verification/01_dashboard_layout.png")

            # 2. Navegar para a página de Administração
            page.get_by_role("link", name="Admin").click()
            expect(page.get_by_role("heading", name="Administração de Agendas")).to_be_visible()

            # Limpeza inicial para garantir um estado limpo
            # Damos um tempo para a lista de agendas carregar antes de tentar limpar
            time.sleep(1)
            agendas_list = page.locator(".agendas-list li")
            count = agendas_list.count()
            if count > 0:
                for i in range(count):
                    agendas_list.first.get_by_role("button", name="Remover").click()
                    time.sleep(0.5) # Pequena pausa entre remoções

            # 3. Adicionar duas agendas de teste
            page.get_by_placeholder("Nome da Sala").fill("Sala Alpha")
            page.get_by_placeholder("URL do Calendário (.ics)").fill("http://example.com/alpha.ics")
            page.get_by_role("button", name="Adicionar").click()
            # Espera explícita pelo primeiro item aparecer
            expect(page.locator(".agendas-list li:has-text('Sala Alpha')")).to_be_visible(timeout=5000)

            page.get_by_placeholder("Nome da Sala").fill("Sala Beta")
            page.get_by_placeholder("URL do Calendário (.ics)").fill("http://example.com/beta.ics")
            page.get_by_role("button", name="Adicionar").click()
            # Espera explícita pelo segundo item aparecer
            expect(page.locator(".agendas-list li:has-text('Sala Beta')")).to_be_visible(timeout=5000)

            # 4. Screenshot do layout do Admin
            page.screenshot(path="jules-scratch/verification/02_admin_layout.png")

            # 5. Reordenar as salas
            page.locator(".agendas-list li").first.get_by_role("button", name="↓").click()
            time.sleep(1)

            # 6. Screenshot da nova ordem
            page.screenshot(path="jules-scratch/verification/03_admin_reordered.png")

            # 7. Salvar a ordem
            page.once("dialog", lambda dialog: dialog.dismiss())
            page.get_by_role("button", name="Salvar Nova Ordem").click()

        except Exception as e:
            print(f"An error occurred: {e}")
            page.screenshot(path="jules-scratch/verification/error.png")

        finally:
            # Limpeza final
            try:
                page.goto("http://localhost:3000/admin")
                time.sleep(1)
                agendas_list = page.locator(".agendas-list li")
                count = agendas_list.count()
                if count > 0:
                    for i in range(count):
                        agendas_list.first.get_by_role("button", name="Remover").click()
                        time.sleep(0.5)
            except Exception as cleanup_error:
                print(f"Cleanup failed: {cleanup_error}")

            browser.close()

if __name__ == "__main__":
    run_verification()
