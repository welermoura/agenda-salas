# backend/routers/groups.py
from fastapi import APIRouter, Depends, HTTPException
from ldap3.core.exceptions import LDAPException

from auth import get_current_user, User
from common import get_ldap_connection, get_group_by_name, get_user_by_dn, load_config

router = APIRouter(
    prefix="/api/groups",
    tags=["groups"],
    dependencies=[Depends(get_current_user)] # Protege todas as rotas neste router
)

def get_attr_value(entry, attr, default=None):
    """Função auxiliar para obter um valor de atributo de uma entrada ldap3."""
    return entry[attr].value if attr in entry and entry[attr].value is not None else default

@router.get("/search/{query}")
async def search_groups(query: str):
    """
    Busca grupos no Active Directory pelo nome (cn).
    """
    if len(query) < 3:
        raise HTTPException(status_code=400, detail="A busca deve ter no mínimo 3 caracteres.")

    try:
        conn = get_ldap_connection() # Conexão com conta de serviço
        config = load_config()
        search_base = config.get('AD_SEARCH_BASE')
        search_filter = f"(&(objectClass=group)(cn=*{query}*))"
        attributes = ['cn', 'description', 'member']

        conn.search(search_base, search_filter, attributes=attributes)

        results = [
            {
                "name": get_attr_value(entry, 'cn'),
                "description": get_attr_value(entry, 'description'),
                "member_count": len(entry['member'].values) if 'member' in entry else 0
            }
            for entry in conn.entries
        ]
        return results
    except LDAPException as e:
        raise HTTPException(status_code=500, detail=f"Erro ao buscar grupos no Active Directory: {e}")

@router.get("/{group_name}/members")
async def get_group_members(group_name: str):
    """
    Lista os membros de um grupo específico.
    """
    try:
        conn = get_ldap_connection()
        group = get_group_by_name(conn, group_name, attributes=['member'])

        if not group:
            raise HTTPException(status_code=404, detail=f"Grupo '{group_name}' não encontrado.")

        member_dns = group.member.values if group.member.values else []

        members_details = []
        attributes_to_get = ['displayName', 'sAMAccountName', 'title']

        for dn in member_dns:
            # A função get_user_by_dn precisa ser implementada ou adaptada em common.py
            # Por enquanto, vamos assumir que ela existe.
            user_entry = get_user_by_dn(conn, dn, attributes=attributes_to_get)
            if user_entry:
                members_details.append({
                    'displayName': get_attr_value(user_entry, 'displayName'),
                    'sAMAccountName': get_attr_value(user_entry, 'sAMAccountName'),
                    'title': get_attr_value(user_entry, 'title'),
                })
            else:
                # Se o membro não for um usuário (pode ser outro grupo), extrai o nome do DN
                cn_part = dn.split(',')[0]
                display_name = cn_part.split('=')[1] if '=' in cn_part else cn_part
                members_details.append({
                    'displayName': f"{display_name} (Objeto não-usuário)",
                    'sAMAccountName': None,
                    'title': None,
                })

        return sorted(members_details, key=lambda x: x['displayName'] or '')

    except LDAPException as e:
        raise HTTPException(status_code=500, detail=f"Erro ao listar membros do grupo: {e}")
