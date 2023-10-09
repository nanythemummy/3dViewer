import logging
import subprocess

from tools.build.jar.config import Config

log = logging.getLogger(__name__)


class JavaToolbox:
    def __init__(self, config: Config):
        self.config = config

    def javac(self, src, dest_dir):
        cmd = ["javac", "-cp", ":".join(self.config.javac_classpath), "-d", dest_dir, src]
        subprocess.run(cmd, check=True)

    def jar(self, manifest, build_root, package, dest):
        cmd = ["jar", "cmvf", manifest, dest, "-C", build_root, package]
        subprocess.run(cmd, check=True)
