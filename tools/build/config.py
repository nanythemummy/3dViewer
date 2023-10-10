import argparse
from dataclasses import dataclass
import logging
import os
import shutil

log = logging.getLogger(__name__)


@dataclass
class Config:
    validate: bool = True
    verbose: bool = False
    assetsdir: str = 'assets'
    builddir: str = 'build'
    distdir: str = 'dist'
    sourcedir: str = 'src'
    staticdir: str = 'static'
    toolsdir: str = 'tools'
    sitexml: str = 'src/site.xml'
    saxonjarpath: str = 'tools/saxon-he-12.3.jar'
    buildsitejarpath: str = 'tools/buildSite-0.0.1-SNAPSHOT.jar'
    xmlstarletpath: str = 'xmlstarlet'
    javapath: str = 'java'

    @property
    def stylesheetdir(self) -> str:
        return os.path.join(self.toolsdir, 'xslt')

    @property
    def schemadir(self) -> str:
        return os.path.join(self.toolsdir, 'schema')

    @property
    def siteschema(self) -> str:
        return os.path.join(self.schemadir, 'site.xsd')

    @property
    def ngsiteschema(self) -> str:
        return os.path.join(self.schemadir, 'site.rng')

    @property
    def pageschema(self) -> str:
        return os.path.join(self.schemadir, 'page.xsd')

    @property
    def ngpageschema(self) -> str:
        return os.path.join(self.schemadir, 'page.rng')

    @property
    def modelsdestdir(self) -> str:
        return os.path.join(self.distdir, 'models')

    @property
    def imgdestdir(self) -> str:
        return os.path.join(self.distdir, 'img')


class NoSuchTool(Exception):
    """We were unable to locate a tool required by our build."""
    pass


def resolveToolLocation(config: Config, locationkey: str, toolname: str):
    """Locate a configurable tool that our build needs.

    locationkey is the name of the config attribute with the tool we want.
    toolname is the name of the tool, which we will use to attempt to
    locate the tool ourselves if the location was not explicitly configured.
    """
    toolpath = getattr(config, locationkey)
    if not toolpath or not os.path.exists(toolpath):
        toolpath = shutil.which(toolname)
        if not toolpath:
            raise NoSuchTool()
        setattr(config, locationkey, toolpath)


def getConfig(args) -> Config:
    """Get the configuration for our tool.

    Currently, only command-line configuration is supported.
    """
    parser = argparse.ArgumentParser()
    parser.add_argument('--assetsdir', help='where model assets are stored', default='assets')
    parser.add_argument('--distdir', help='where final build output is written', default='dist')
    parser.add_argument('--builddir', help='where intermediate build output is written', default='build')
    parser.add_argument('--sitexml', help='location of site XML definition', default='src/site.xml')
    parser.add_argument('--xmlstarletpath', help='location of XML Starlet, used for XML Include/Schema processing')
    parser.add_argument('--javapath', help='Location of Java runtime command, used for XSLT')
    parser.add_argument('--saxonjarpath', help='Location of Saxon JAR, used for XSLT', default='tools/saxon-he-12.3.jar')
    parser.add_argument(
        '--buildsitejarpath',
        help='Location of 3dcoffins site-building JAR, used for XSLT',
        default='tools/buildSite-0.0.1-SNAPSHOT.jar'
    )
    parser.add_argument('--no-val', dest='validate', action='store_false', help='Skip XML validation step', default=True)
    parser.add_argument('-v', '--verbose', dest='verbose', action='store_true', help='Verbose output')

    ns = parser.parse_args(args[1:])
    config = Config(**vars(ns))

    # We're going to blow away the dist and build directories before writing to
    # them, so we ought to be at least a little careful here!
    if config.distdir == '/':
        parser.error('Cannot set dist directory to root!')
    if config.builddir == '/':
        parser.error('Cannot set build directory to root!')

    # Fill in defaults for external tool locations if necessary.
    try:
        resolveToolLocation(config, 'xmlstarletpath', 'xmlstarlet')
    except NoSuchTool:
        parser.error('XML Starlet not found. Install XML Starlet with Homebrew or specify the location of the executable using --xmlstarletpath.')

    try:
        resolveToolLocation(config, 'javapath', 'java')
    except NoSuchTool:
        parser.error('Java not found. Install OpenJDK with Homebrew or specify the location of the Java runtime using --javapath.')

    log.debug("config: %s", config)
    return config
