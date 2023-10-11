from dataclasses import dataclass
import logging

from .config import Config
from .cache import XMLDocumentCache
from .xmltoolbox import XMLToolbox

log = logging.getLogger(__name__)


@dataclass
class Context:
    config: Config
    cache: XMLDocumentCache
    toolbox: XMLToolbox
