import logging
import xml.etree.ElementTree as ET

log = logging.getLogger(__name__)


class XMLDocumentCache:
    """A cache for the XML element trees (i.e. DOMs) that we've loaded.

    This helps us avoid parsing the same XML files multiple times (in Python, at least).

    General assumption: we don't care about the document object per se. We just
    cache the root element of each document.
    """

    def __init__(self):
        self.cache = {}

    def load(self, src: str) -> ET.Element:
        if src in self.cache:
            return self.cache[src]

        log.debug('Loading XML: %s', src)
        root = ET.parse(src).getroot()
        root.attrib['src'] = src  # TODO: carried over from previous build.py code; do we still need this?
        return root

    def exists(self, src):
        return src in self.cache

    def remove(self, src):
        del self.cache[src]

    def flush(self):
        self.cache = {}
