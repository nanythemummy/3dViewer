import os.path
import sys

import tools.build.config


CURRENT_VERSION = '0.0.1-SNAPSHOT'


class Config(tools.build.config.Config):
    package_path: str
    tools_java_dir: str
    tools_manifest: str
    tools_java_src: str
    build_tools_dir: str
    build_java_dir: str
    javac_classpath: str
    build_buildsite_jar: str
    javacpath: str
    jarcmdpath: str


def getConfig():
    doc = tools.build.config.loadConfigXml('build_config.xml')
    config = Config()
    config.loadSection(doc, 'site')
    config.loadSection(doc, 'buildJar')

    try:
        tools.build.config.resolveToolLocation(config, 'javacpath', 'javac')
        tools.build.config.resolveToolLocation(config, 'jarcmdpath', 'jar')
    except tools.build.config.NoSuchTool as e:
        print(e.message, file=sys.stderr)
        sys.exit(1)

    return config
