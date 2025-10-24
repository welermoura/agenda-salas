# backend/routers/users.py
from fastapi import APIRouter, Depends, HTTPException
from ldap3.core.exceptions import LDAPException
from ldap3 import MODIFY_REPLACE

from auth import get_current_user, User
from common import get_ldap_connection, get_user_by_samaccountname, search_general_users # Supondo que search_general_users será movida para common

router = APIRouter(
    prefix="/api/users",
    tags=["users"],
    dependencies=[Depends(get_current_user)] # Protege todas as rotas neste router
)

# ==============================================================================
# Funções Auxiliares (movidas de Flask para cá, temporariamente)
# TODO: Mover a lógica de negócio para common.py
# ==============================================================================
def get_user_status(user_entry):
    if not user_entry or 'userAccountControl' not in user_entry:
        return "Desconhecido"
    uac = user_entry.userAccountControl.value
    if uac & 2:
        return "Desativado"
    return "Ativo"

# ==============================================================================
# Endpoints da API de Usuários
# ==============================================================================

@router.get("/search/{query}")
async def search_users(query: str):
    """
    Busca usuários no Active Directory pelo nome de exibição ou sAMAccountName.
    """
    if len(query) < 3:
        raise HTTPException(status_code=400, detail="A busca deve ter no mínimo 3 caracteres.")

    try:
        conn = get_ldap_connection() # Conexão com conta de serviço
        # Esta função precisa ser criada ou movida para common.py
        # search_general_users foi uma função do código Flask.
        # Vamos usar uma busca ldap3 direta por enquanto.

        config = load_config()
        search_base = config.get('AD_SEARCH_BASE')
        search_filter = f"(&(objectClass=user)(objectCategory=person)(|(displayName=*{query}*)(sAMAccountName=*{query}*)))"
        attributes = ['displayName', 'sAMAccountName', 'title', 'l', 'userAccountControl', 'distinguishedName']

        conn.search(search_base, search_filter, attributes=attributes)

        results = [
            {
                "displayName": entry.displayName.value,
                "samAccountName": entry.sAMAccountName.value,
                "title": entry.title.value if 'title' in entry else None,
                "location": entry.l.value if 'l' in entry else None,
                "status": get_user_status(entry)
            }
            for entry in conn.entries
        ]
        return results
    except LDAPException as e:
        raise HTTPException(status_code=500, detail=f"Erro ao buscar no Active Directory: {e}")


@router.get("/{username}")
async def get_user_details(username: str):
    """
    Retorna os detalhes de um usuário específico do Active Directory.
    """
    try:
        conn = get_ldap_connection()
        user_details = get_user_by_samaccountname(conn, username, attributes=['*', 'msDS-UserPasswordExpiryTimeComputed'])

        if not user_details:
            raise HTTPException(status_code=404, detail="Usuário não encontrado.")

        # Constrói a resposta com os atributos desejados
        response_data = {attr: user_details[attr].value for attr in user_details.entry_attributes if user_details[attr].value is not None}
        response_data["status"] = get_user_status(user_details)

        return response_data
    except LDAPException as e:
        raise HTTPException(status_code=500, detail=f"Erro ao buscar detalhes do usuário: {e}")


@router.post("/{username}/toggle-status")
async def toggle_user_status(username: str, current_user: User = Depends(get_current_user)):
    """
    Ativa ou desativa a conta de um usuário.
    """
    # Exemplo de verificação de permissão
    # if current_user.access_level != 'full':
    #     raise HTTPException(status_code=403, detail="Permissão negada.")

    try:
        conn = get_ldap_connection() # Conexão com conta de serviço para a modificação
        user = get_user_by_samaccountname(conn, username, ['userAccountControl', 'distinguishedName'])

        if not user:
            raise HTTPException(status_code=404, detail="Usuário não encontrado.")

        uac = user.userAccountControl.value
        is_disabled = uac & 2

        new_uac, action_message = (uac - 2, "ativada") if is_disabled else (uac + 2, "desativada")

        conn.modify(user.distinguishedName.value, {'userAccountControl': [(ldap3.MODIFY_REPLACE, [str(new_uac)])]})

        if conn.result['description'] == 'success':
            logging.info(f"Conta '{username}' foi {action_message} por '{current_user.username}'.")
            return {"message": f"Conta do usuário '{username}' foi {action_message} com sucesso."}
        else:
            raise HTTPException(status_code=500, detail=f"Falha ao modificar o usuário: {conn.result['message']}")

    except LDAPException as e:
        raise HTTPException(status_code=500, detail=f"Erro LDAP ao alterar status: {e}")
