import argparse
import logging
import os
import shutil

log = logging.getLogger(__name__)


class Config:
    def __init__(
            self,
            assetsdir: str = 'assets',
            builddir: str = 'build',
            distdir: str = 'build',
            sourcedir: str = 'src',
            staticdir: str = 'static',
            toolsdir: str = 'tools',
            sitexml: str = 'site.xml',
            xmlstarletpath: str = '',
            javapath: str = '',
            validate: bool = True,
            verbose: bool = False,
    ):
        self.assetsdir = assetsdir
        self.builddir = builddir
        self.distdir = distdir
        self.sourcedir = sourcedir
        self.staticdir = staticdir
        self.toolsdir = toolsdir
        self.sitexml = sitexml
        self.xmlstarletpath = xmlstarletpath
        self.javapath = javapath
        self.validate = validate
        self.verbose = verbose

    @property
    def stylesheetdir(self) -> str:
        return os.path.join(self.toolsdir, 'xslt')

    @property
    def schemadir(self) -> str:
        return os.path.join(self.toolsdir, 'schema')

    @property
    def saxonjarpath(self) -> str:
        return os.path.join(self.toolsdir, 'saxon-he-12.3.jar')

    @property
    def buildsitejarpath(self) -> str:
        return os.path.join(self.toolsdir, 'buildSite-0.0.1-SNAPSHOT.jar')

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
    def srcsitexml(self) -> str:
        return os.path.join(self.sourcedir, self.sitexml)

    @property
    def ngpageschema(self) -> str:
        return os.path.join(self.schemadir, 'page.rng')

    @property
    def buildsitexml(self) -> str:
        return os.path.join(self.builddir, self.sitexml)

    @property
    def modelsdestdir(self) -> str:
        return os.path.join(self.distdir, 'models')

    @property
    def imgdestdir(self) -> str:
        return os.path.join(self.distdir, 'img')

    @property
    def distsitexml(self) -> str:
        return os.path.join(self.distdir, self.sitexml)


class NoSuchTool(Exception):
    """We were unable to locate a tool required by our build."""
    def __init__(self, toolname):
        self.toolname = toolname

    @property
    def message(self) -> str:
        if self.toolname == 'xmlstarlet':
            return 'XML Starlet not found. Install XML Starlet with Homebrew or specify the location of the executable using --xmlstarletpath.'
        elif self.toolname == 'java':
            return 'Java not found. Install OpenJDK with Homebrew or specify the location of the Java runtime using --javapath.'
        else:
            return f'Required tool {e.toolname} not found.'


def resolveToolLocation(config: Config, locationkey: str, toolname: str):
    """Locate a configurable tool that our build needs.

    locationkey is the name of the config attribute with the tool we want.
    toolname is the name of the tool, which we will use to attempt to
    locate the tool ourselves if the location was not explicitly configured.
    """
    toolpath = getattr(config, locationkey, '')
    if not toolpath or not os.path.exists(toolpath):
        toolpath = shutil.which(toolname)
        if not toolpath:
            raise NoSuchTool()
        setattr(config, locationkey, toolpath)


def resolveToolLocations(config: Config):
    resolveToolLocation(config, 'xmlstarletpath', 'xmlstarlet')
    resolveToolLocation(config, 'javapath', 'java')


def getConfig(args) -> Config:
    """Get the configuration for our tool.

    Currently, only command-line configuration is supported.
    """
    parser = argparse.ArgumentParser()
    parser.add_argument('--assetsdir', help='where model assets are stored', default='assets')
    parser.add_argument('--distdir', help='where final build output is written', default='dist')
    parser.add_argument('--builddir', help='where intermediate build output is written', default='build')
    parser.add_argument('--xmlstarletpath', help='location of XML Starlet, used for XML Include/Schema processing')
    parser.add_argument('--javapath', help='Location of Java runtime command, used for XSLT')
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
        resolveToolLocations(config)
    except NoSuchTool as e:
        parser.error(e.message)

    log.debug("config: %s", config)
    return config
