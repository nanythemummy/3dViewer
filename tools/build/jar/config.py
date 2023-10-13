import os.path
from typing import List
import sys

import tools.build.config


CURRENT_VERSION = '0.0.1-SNAPSHOT'


class Config(tools.build.config.Config):
    def __init__(self, **params):
        super(Config, self).__init__(**params)
        self.version = params.get('version', CURRENT_VERSION)
        self.package_path = os.path.join('edu', 'berkeley', '_3dcoffins')
        self.javacpath = ''
        self.jarcmdpath = ''

    @property
    def tools_java_dir(self) -> str:
        return os.path.join(self.toolsdir, "java")

    @property
    def tools_manifest(self) -> str:
        return os.path.join(self.toolsdir, 'java', 'META-INF', 'MANIFEST.MF')

    @property
    def tools_java_src(self) -> str:
        return os.path.join(self.tools_java_dir, self.package_path)

    @property
    def build_tools_dir(self) -> str:
        return os.path.join(self.builddir, "tools")

    @property
    def build_java_dir(self) -> str:
        return os.path.join(self.builddir, "tools", "java")

    @property
    def javac_classpath(self) -> List[str]:
        return [self.tools_java_dir, self.saxonjarpath]

    @property
    def build_buildsite_jar(self) -> str:
        return os.path.join(self.build_tools_dir, f'buildSite-{self.version}.jar')


def getConfig():
    doc = tools.build.config.loadConfigXml('build_config.xml')
    config = Config()
    config.loadSection(doc, 'site')
    config.loadSection(doc, 'buildSiteJar')

    try:
        tools.build.config.resolveToolLocation(config, 'javacpath', 'javac')
        tools.build.config.resolveToolLocation(config, 'jarcmdpath', 'jar')
    except tools.build.config.NoSuchTool as e:
        print(e.message, file=sys.stderr)
        sys.exit(1)

    return config
