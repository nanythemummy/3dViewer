#!/usr/bin/env python3

"""
build_jar.py builds the buildSite Java tool, which does all the XSLT processing
for the site.

buildSite comes in the form of an java-executable JAR file. The built JAR will be
written to build/tools/buildSite-{VERSION}.jar. From there, it must be copied to
the tools/ directory before it can be used by build.py.

This is a separate operation from build.py because it is not anticipated that the
JAR will need to be modified often. The buildSite JAR is checked into the repo, so
running this is only necessary if that JAR needs to be updated.

Subsidiary modules are in tools/build/jar.
"""

import glob
import logging
import os
import shutil
import sys

from tools.build.jar import config
from tools.build.jar import javatoolbox

logging.basicConfig(level=logging.DEBUG, stream=sys.stdout, format='%(levelname)s: %(message)s')
log = logging.getLogger(__name__)


class Context:
    def __init__(self):
        self.config: config.Config = config.getConfig()
        self.toolbox: javatoolbox.JavaToolbox = javatoolbox.JavaToolbox(self.config)


def compileSources(ctx: Context):
    for src in glob.iglob(os.path.join(ctx.config.tools_java_src, '*.java')):
        log.info(f"Compiling {src}")
        ctx.toolbox.compile(src=src, dest_dir=ctx.config.build_java_dir)


def createJar(ctx: Context):
    log.info(f"Creating {ctx.config.build_buildsite_jar}")
    out_path = os.path.abspath(ctx.config.build_buildsite_jar)
    ctx.toolbox.buildJar(
        manifest=ctx.config.tools_manifest,
        build_root=ctx.config.build_java_dir,
        package=ctx.config.package_path,
        dest=out_path,
    )


def prepareBuildDir(ctx: Context):
    log.info("Preparing build directory")
    os.makedirs(ctx.config.build_java_dir, exist_ok=True)


def cleanBuildDir(ctx: Context):
    log.info("Cleaning old JAR build output")
    if os.path.exists(ctx.config.build_tools_dir):
        shutil.rmtree(ctx.config.build_tools_dir)
    if os.path.exists(ctx.config.build_buildsite_jar):
        os.unlink(ctx.config.build_buildsite_jar)


def buildJar(ctx: Context):
    cleanBuildDir(ctx)
    prepareBuildDir(ctx)
    compileSources(ctx)
    createJar(ctx)


def main(args):
    try:
        ctx = Context()
        buildJar(ctx)
        return 0
    except Exception as e:
        log.exception(f"Failed to build jar")
        return 1


if __name__ == "__main__":
    rv = main(sys.argv)
    sys.exit(rv)
