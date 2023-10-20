import logging
import subprocess

from tools.build.jar.config import Config

log = logging.getLogger(__name__)


class JavaToolbox:
    def __init__(self, config: Config):
        self.javac_classpath = config.javac_classpath
        self.javac = config.javacpath
        self.jar = config.jarcmdpath

    def compile(self, src, dest_dir):
        cmd = [self.javac, "-cp", self.javac_classpath, "-d", dest_dir, src]
        subprocess.run(cmd, check=True)

    def buildJar(self, manifest, build_root, package, dest):
        cmd = [self.jar, "cmvf", manifest, dest, "-C", build_root, package]
        subprocess.run(cmd, check=True)
