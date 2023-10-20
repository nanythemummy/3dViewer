import argparse
import logging
import os
import shutil
import xml.etree.ElementTree as ET

log = logging.getLogger(__name__)


class Config:
    assetsdir: str
    builddir: str
    distdir: str
    sourcedir: str
    staticdir: str
    xmlstarletpath: str
    javapath: str
    validate: bool
    verbose: bool

    stylesheetdir: str
    saxonjarpath: str
    buildsitejarpath: str
    ngsiteschema: str
    ngpageschema: str

    srcsitexml: str
    distsitexml: str

    def loadSection(self, doc: ET.Element, section_tag: str):
        section = doc.find(section_tag)
        for e in section:
            setattr(self, e.tag, e.text.strip())


class NoSuchTool(Exception):
    """We were unable to locate a tool required by our build."""
    def __init__(self, toolname):
        self.toolname = toolname

    @property
    def message(self) -> str:
        if self.toolname == 'xmlstarlet':
            return 'XML Starlet not found. Install XML Starlet with Homebrew or specify the location of the executable using --xmlstarletpath.'
        elif self.toolname in ['java', 'javac', 'jar']:
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


def loadConfigXml(fname: str) -> ET.Element:
    return ET.parse(fname).getroot()


def loadConfigFromFile(fname: str) -> Config:
    doc = loadConfigXml(fname)
    config = Config()
    config.loadSection(doc, 'site')
    return config


def getConfig(args) -> Config:
    """Get the configuration for our tool.

    Currently, only command-line configuration is supported.
    """
    parser = argparse.ArgumentParser()
    parser.add_argument('--assetsdir', help='where model assets are stored')
    parser.add_argument('--distdir', help='where final build output is written')
    parser.add_argument('--builddir', help='where intermediate build output is written')
    parser.add_argument('--xmlstarletpath', help='location of XML Starlet, used for XML Include/Schema processing')
    parser.add_argument('--javapath', help='Location of Java runtime command, used for XSLT')
    parser.add_argument('--no-val', dest='validate', action='store_false', help='Skip XML validation step', default=True)
    parser.add_argument('-v', '--verbose', dest='verbose', action='store_true', help='Verbose output')

    ns = parser.parse_args(args[1:])
    config = loadConfigFromFile('build_config.xml')
    for k, v in vars(ns).items():
        if v is not None:
            setattr(config, k, v)

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
