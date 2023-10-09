#!/usr/bin/env python3

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
        self.config: config.Config = config.Config()
        self.toolbox: javatoolbox.JavaToolbox = javatoolbox.JavaToolbox(self.config)


def compileSources(ctx: Context):
    for src in glob.iglob(os.path.join(ctx.config.package_src_dir, '*.java')):
        log.info(f"Compiling {src}")
        ctx.toolbox.javac(src=src, dest_dir=ctx.config.build_java_dir)


def createJar(ctx: Context):
    log.info(f"Creating {ctx.config.out_jar_filename}")
    out_path = os.path.abspath(ctx.config.out_jar_filename)
    ctx.toolbox.jar(
        manifest=ctx.config.manifest_src,
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
    if os.path.exists(ctx.config.out_jar_filename):
        os.unlink(ctx.config.out_jar_filename)


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
