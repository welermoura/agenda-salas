# backend/routers/groups.py
from fastapi import APIRouter, Depends, HTTPException
from typing import List
import ldap
import ldap_utils
from logging_config import logger

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
        results = conn.search_s(search_base, ldap.SCOPE_SUBTREE, search_filter)

        # O resultado precisa ser decodificado de bytes para strings para ser serializável em JSON
        groups = []
        for dn, attrs in results:
            if dn is not None:
                decoded_attrs = {}
                for key, value in attrs.items():
                    decoded_values = [v.decode('utf-8', 'ignore') for v in value]
                    decoded_attrs[key] = decoded_values
                groups.append({"dn": dn, "attrs": decoded_attrs})

        logger.info(f"Retornando {len(groups)} grupos encontrados no LDAP.")
        return groups
    except ldap.LDAPError as e:
        logger.error(f"Erro no LDAP ao listar grupos: {e}")
        raise HTTPException(status_code=500, detail=f"Erro no LDAP: {e}")
