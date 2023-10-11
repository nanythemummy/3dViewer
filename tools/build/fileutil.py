import logging
import os
import shutil

log = logging.getLogger(__name__)


def cleanDirectory(dirpath):
    """Clean out the contents of a directory.

    Note that we intentionally don't just use shutil.rmtree on dirpath and
    recreate it -- development servers like Python's SimpleHTTPServer will not
    switch to the new directory. Instead, this function just clears out its
    contents.
    """
    for root, dirs, files in os.walk(dirpath):
        for f in files:
            os.unlink(os.path.join(root, f))
        for d in dirs:
            shutil.rmtree(os.path.join(root, d))
