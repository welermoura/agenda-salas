# backend/routers/users.py
from fastapi import APIRouter, Depends, HTTPException
from typing import List
import ldap
from .. import ldap_utils
from ..logging_config import logger

router = APIRouter(
    prefix="/api/users",
    tags=["users"],
)

@router.get("/", response_model=List[dict])
def list_users(conn: ldap.ldapobject.SimpleLDAPObject = Depends(ldap_utils.get_ldap_connection)):
    """
    Lista todos os usuários no Base DN.
    (Implementação de busca real a ser adicionada)
    """
    logger.info("Endpoint /api/users chamado")
    search_filter = "(objectClass=person)"
    search_base = ldap_utils.get_base_dn()
    try:
        # A busca real no LDAP seria algo como:
        # results = conn.search_s(search_base, ldap.SCOPE_SUBTREE, search_filter)
        # users = [{"dn": dn, "attrs": attrs} for dn, attrs in results if dn is not None]
        # return users

        # Por enquanto, retorna dados mocados
        mock_users = [
            {"dn": f"cn=John Doe,ou=users,{search_base}", "attrs": {"cn": [b"John Doe"], "mail": [b"john.doe@example.com"]}},
            {"dn": f"cn=Jane Smith,ou=users,{search_base}", "attrs": {"cn": [b"Jane Smith"], "mail": [b"jane.smith@example.com"]}}
        ]
        logger.info(f"Retornando {len(mock_users)} usuários (mocados).")
        return mock_users
    except ldap.LDAPError as e:
        logger.error(f"Erro no LDAP ao listar usuários: {e}")
        raise HTTPException(status_code=500, detail=f"Erro no LDAP: {e}")
