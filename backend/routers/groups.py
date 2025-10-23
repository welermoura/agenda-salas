# backend/routers/groups.py
from fastapi import APIRouter, Depends, HTTPException
from typing import List
import ldap
from .. import ldap_utils
from ..logging_config import logger

router = APIRouter(
    prefix="/api/groups",
    tags=["groups"],
)

@router.get("/", response_model=List[dict])
def list_groups(conn: ldap.ldapobject.SimpleLDAPObject = Depends(ldap_utils.get_ldap_connection)):
    """
    Lista todos os grupos no Base DN.
    (Implementação de busca real a ser adicionada)
    """
    logger.info("Endpoint /api/groups chamado")
    search_filter = "(objectClass=group)"
    search_base = ldap_utils.get_base_dn()
    try:
        # A busca real no LDAP seria algo como:
        # results = conn.search_s(search_base, ldap.SCOPE_SUBTREE, search_filter)
        # groups = [{"dn": dn, "attrs": attrs} for dn, attrs in results if dn is not None]
        # return groups

        # Por enquanto, retorna dados mocados
        mock_groups = [
            {"dn": f"cn=Admins,ou=groups,{search_base}", "attrs": {"cn": [b"Admins"]}},
            {"dn": f"cn=Developers,ou=groups,{search_base}", "attrs": {"cn": [b"Developers"]}}
        ]
        logger.info(f"Retornando {len(mock_groups)} grupos (mocados).")
        return mock_groups
    except ldap.LDAPError as e:
        logger.error(f"Erro no LDAP ao listar grupos: {e}")
        raise HTTPException(status_code=500, detail=f"Erro no LDAP: {e}")
