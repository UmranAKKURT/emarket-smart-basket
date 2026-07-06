from __future__ import annotations

import logging


LOG_FORMAT = (
    "%(asctime)s | %(levelname)s | %(name)s | %(message)s"
)


def configure_logging(level: str) -> None:
    """Uygulama loglarını tek ve tutarlı bir formatta yapılandırır."""

    numeric_level = getattr(logging, level.upper(), logging.INFO)
    root_logger = logging.getLogger()

    if not root_logger.handlers:
        logging.basicConfig(level=numeric_level, format=LOG_FORMAT)
    else:
        root_logger.setLevel(numeric_level)

    logging.getLogger("emarket").setLevel(numeric_level)

