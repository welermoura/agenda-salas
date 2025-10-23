# backend/logging_config.py
import logging
from logging.handlers import RotatingFileHandler

def setup_logging():
    """Configura o sistema de logging para a aplicação."""
    logger = logging.getLogger('ad_management_logger')
    logger.setLevel(logging.INFO)

    # Evita adicionar múltiplos handlers se a função for chamada mais de uma vez
    if logger.hasHandlers():
        logger.handlers.clear()

    # Formato do log
    formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )

    # Handler para rotacionar o arquivo de log (ex: 1MB por arquivo, mantendo 5 backups)
    handler = RotatingFileHandler('ad_management.log', maxBytes=1024*1024, backupCount=5)
    handler.setFormatter(formatter)

    logger.addHandler(handler)

    return logger

# Cria uma instância do logger para ser usada em outros módulos
logger = setup_logging()
