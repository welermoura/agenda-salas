
from playwright.sync_api import sync_playwright, expect

def run_verification():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        try:
            # Navigate to the admin page
            page.goto("http://localhost:3000/admin")

            # Define test data
            test_name = "Sala de Teste para Remoção"
            test_url = "http://example.com/test-removal.ics"

            # Fill the form and add a new room
            page.get_by_placeholder("Nome da Sala").fill(test_name)
            page.get_by_placeholder("URL da Agenda (.ics)").fill(test_url)
            page.get_by_role("button", name="Adicionar Sala").click()

            # Wait for the new room to appear in the list
            new_room_entry = page.locator(f'li:has-text("{test_name}")')
            expect(new_room_entry).to_be_visible(timeout=5000)

            print("Sala de teste adicionada com sucesso.")

            # Find the remove button for the new room and click it
            remove_button = new_room_entry.get_by_role("button", name="Remover")
            remove_button.click()

            # Expect the room entry to disappear
            expect(new_room_entry).not_to_be_visible(timeout=5000)

            print("Sala de teste removida com sucesso.")
            print("Verificação da funcionalidade de remoção concluída com sucesso!")

        except Exception as e:
            print(f"Erro durante a verificação: {e}")
        finally:
            browser.close()

if __name__ == "__main__":
    run_verification()
