#!/usr/bin/env python3

import logging
import sys

import tools.build.config
from tools.build.fileutil import cleanDirectory

logging.basicConfig(level=logging.INFO, stream=sys.stdout, format='%(levelname)s: %(message)s')
log = logging.getLogger('clean')

try:
    config = tools.build.config.Config()
    cleanDirectory(config.builddir)
    cleanDirectory(config.distdir)
except Exception as e:
    log.exception('Failed to clean build output')
