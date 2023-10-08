#!/usr/bin/env python3

# build.py builds the 3dViewer site from site structure
# defined in site.xml and included files, as well as
# build rules defined here.

import argparse
import logging
import os
import shutil
import subprocess
import sys
import xml.etree.ElementTree as ET

import tools.build.convertTransliteration


logging.basicConfig(level=logging.DEBUG, stream=sys.stdout, format='%(levelname)s: %(message)s')
log = logging.getLogger(__name__)


def expandPath(config, path):
    """Expand any magic variables in source paths."""
    path = path.replace('${assets}', config.assetsdir)
    return os.path.abspath(path)


def loadSite(config):
    """Load the site's XML definition.

    Assumes the site XML has been preprocessed.
    """
    log.debug('Loading site: %s', config.sitexml)
    site = ET.parse(config.fullsitexml).getroot()
    site.attrib['src'] = config.fullsitexml
    return site


def xslTransform(config, stylesheet, src, dest, includes=False):
    """Use XSLT to transform an XML file to an output file.

    We use the Saxon XSLT processor, which supports the latest and greatest
    version of XSLT. We splice in XIncludes if they are present.
    """
    description = stylesheet
    if includes:
        description += ', with XIncludes'
    log.debug('Transform: %s -> (%s) -> %s', src, description, dest)
    cmd = ['java', '-jar', 'tools/saxon-he-12.3.jar', '-xsl:' + stylesheet, '-s:' + src, '-o:' + dest]
    if includes:
        cmd.append('-xi')
    if config.verbose:
        cmd.append('verbose=true')
    destdir = os.path.dirname(dest)
    if destdir:
        cmd.append('destdir=' + destdir)
    subprocess.run(cmd, check=True)


def xmlSchemaValidate(config, schema, target):
    """Use XML Schema to validate an XML file.

    We use XML Starlet for this, as Saxon only includes schema validation with
    the paid version of their tool.
    """
    log.debug('Validating XML against schema %s: %s', schema, target)
    subprocess.run([config.xmlstarletpath, 'val', '-q', '-e', '-s', schema, target], check=True)


def xmlValidate(config, target):
    """Check an XML file for well-formedness.

    We use XML Starlet for this for convenience.
    """
    log.debug('Validating XML: %s', target)
    subprocess.run([config.xmlstarletpath, 'val', '-q', '-e', target], check=True)


def copyElementAsset(config, elem):
    """Copy a asset, represented by an XML element, to the output directory."""
    src = expandPath(config, elem.attrib['src'])
    dest = os.path.join(config.distdir, elem.attrib['dest'])
    log.debug('Copying asset: %s -> %s', src, dest)
    shutil.copy(src, dest)


def copyAssets(config):
    """Copy all assets to the output directory."""
    site = loadSite(config)

    # Most of our assets can just be copied over wholesale from
    # the static directory.
    log.info('Copying all static assets...')
    staticdir = 'static'
    for item in os.listdir(staticdir):
        src = os.path.join(staticdir, item)
        dest = os.path.join(config.distdir, item)
        if os.path.isdir(src):
            log.debug('Copying directory: %s -> %s', src, dest)
            shutil.copytree(src, dest)
        else:
            log.debug('Copying: %s -> %s', src, dest)
            shutil.copy(src, dest)

    #there may be several first party javascript files in the dist directory.
    #scoop those up and copy them over.
    log.info('Copying javascript...')
    listjs = [fl for fl in os.listdir('src') if os.path.splitext(fl)[1]=='.js']
    for item in listjs:
        shutil.copy(os.path.join('src', item), os.path.join(config.distdir, 'js', item))
    
    log.info('Copying models...')
    # Models could in theory be copied wholesale from our assets
    # repository, but I'll do a somewhat more streamlined path and
    # follow model definitions to figure out which models are
    # actually needed.
    modelsdestdir = os.path.join(config.distdir, 'models')

    os.makedirs(modelsdestdir)
    for model in site.findall('.//model'):
        copyElementAsset(config, model)

    log.info('Copying hieroglyphics...')
    imgdestdir = os.path.join(config.distdir, 'img')
    if not os.path.exists(imgdestdir):
        os.makedirs(imgdestdir)
    for himg in site.findall('.//himg'):
        copyElementAsset(config, himg)


def convertTransliteration(src, dest):
    """Convert transliterations from MdC to Unicode."""
    log.info('Processing transliterations...')
    log.debug('Tlit transform: %s -> %s', src, dest)
    with open(dest, 'w') as outfile:
        with open(src) as infile:
            tools.build.convertTransliteration.transform(infile, outfile)


def buildSite(config):
    """Build the entire site.

    Assumes the site XML has been preprocessed.
    Assets are copied to the output directory wholesale.
    Transliterations are converted to Unicode.
    Finally, HTML is generated from the site XML.
    We use XSLT as defined by site2html.xsl to do the transformation.
    """
    copyAssets(config)

    tlitfname = os.path.join(config.builddir, 'site.transliterated.xml')
    convertTransliteration(src=config.fullsitexml, dest=tlitfname)

    log.info('Building site HTML...')
    indexdest = os.path.join(config.distdir, 'index.html')
    xslpath = os.path.join(config.stylesheetdir, 'site2html.xsl')
    xslTransform(config, stylesheet=xslpath, src=tlitfname, dest=indexdest)


def validateSiteSchema(config):
    """Validate that our site XML matches our custom schema.

    Assumes site.xml has been preprocessed.
    """
    log.info('Validating site XML against schema...')
    schemafname = os.path.join(config.schemadir, 'site.xsd')
    xmlSchemaValidate(config, schema=schemafname, target=config.fullsitexml)


class NoSuchTool(Exception):
    """We were unable to locate a tool required by our build."""
    pass


def resolveToolLocation(config, locationkey, toolname):
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


def getConfig(args):
    """Get the configuration for our tool.

    Currently, only comamnd-line configuration is supported.
    """
    parser = argparse.ArgumentParser()
    parser.add_argument('--assetsdir', help='where model assets are stored', default='assets')
    parser.add_argument('--distdir', help='where final build output is written', default='dist')
    parser.add_argument('--builddir', help='where intermediate build output is written', default='build')
    parser.add_argument('--sitexml', help='location of site XML definition', default='src/site.xml')
    parser.add_argument('---xmlstarletpath', help='location of XML Starlet, used for XML Include/Schema processing')
    parser.add_argument('--no-val', dest='validate', action='store_false', help='Skip XML validation step', default=True)
    parser.add_argument('-v', '--verbose', dest='verbose', action='store_true', help='Verbose output')
    config = parser.parse_args(args[1:])

    # We're going to blow away the dist and build directories before writing to
    # them, so we ought to be at least a little careful here!
    if config.distdir == '/':
        parser.error('Cannot set dist directory to root!')
    if config.builddir == '/':
        parser.error('Cannot set build directory to root!')

    # Fill in defaults for tool locations if necessary.
    try:
        resolveToolLocation(config, 'xmlstarletpath', 'xmlstarlet')
    except NoSuchTool:
        parser.error('XML Starlet not found. Install XML Starlet with Homebrew or specify the location of the executable using --xmlstarletpath.')

    # Some extra configuration defined here for convenience
    config.fullsitexml = os.path.join(config.builddir, 'site.preprocessed.xml')
    config.stylesheetdir = os.path.join('tools', 'xslt')
    config.schemadir = os.path.join('tools', 'schema')

    if config.verbose:
        log.setLevel(logging.DEBUG)
    else:
        log.setLevel(logging.INFO)

    return config


def assembleSite(config):
    """Process XIncludes in site.xml, writing the results to dest.

    This is so that future steps have a fully-expanded site.xml to
    work with, and don't have to worry about pulling in the page XML.
    """
    log.debug('Assembling: %s', config.fullsitexml)
    # Transforming with identity.xsl has the effect of simply pulling in
    # XIncludes and nothing else.
    xslpath = os.path.join(config.stylesheetdir, 'identity.xsl')
    xslTransform(
        config, stylesheet=xslpath, src=config.sitexml, dest=config.fullsitexml, includes=True)


def extractIncludes(config, source):
    """Preprocess the source XML to a text file containing just includes.

    The source XML is assumed to be well-formed.
    """
    outputfname, _ = os.path.splitext(os.path.basename(source))
    outputfname += '_includes.txt'
    outputpath = os.path.join(config.builddir, outputfname)
    xslpath = os.path.join(config.stylesheetdir, 'includes.xsl')
    xslTransform(config, stylesheet=xslpath, src=source, dest=outputpath)
    return outputpath


def validateXMLAndIncludes(config, source):
    """Check that the source XML and its includes are well-formed."""
    sourcedir = os.path.dirname(source)
    xmlValidate(config, source)
    includespath = extractIncludes(config, source)
    with open(includespath, 'r') as includes:
        for include in includes:
            include = include.strip()
            if not include:
                continue
            include = os.path.join(sourcedir, include)
            if not os.path.isfile(include):
                raise RuntimeError('Unable to locate included file: {}'.format(include))
            validateXMLAndIncludes(config, include)


def preprocessSite(config):
    log.info('Preprocessing site XML...')
    if config.validate:
        validateXMLAndIncludes(config, config.sitexml)
    assembleSite(config)


def cleanDirectory(dirpath):
    """Clean out the contents of a directory.

    Note that we intentionally don't just use shutil.rmtree on dirpath and
    recreate it -- development servers like Python's SimpleHTTPServer will not
    switch to the new directory. Instead, this function just clears out its
    contents.
    """
    for root, dirs, files in os.walk(dirpath):
        for f in files:
            os.unlink(os.path.join(root, f))
        for d in dirs:
            shutil.rmtree(os.path.join(root, d))


def prepareDistDir(config):
    """Clean the output directory, or create it if it doesn't exist."""
    if not os.path.exists(config.distdir):
        log.info('Creating dist directory: %s', config.distdir)
        os.makedirs(config.distdir)
        return

    log.info('Cleaning dist directory: %s', config.distdir)
    cleanDirectory(config.distdir)


def prepareBuildDir(config):
    """Clean the intermediate build directory, or create it if it doesn't exist."""
    if not os.path.exists(config.builddir):
        log.info('Creating build directory: %s', config.builddir)
        os.makedirs(config.builddir)
        return

    log.info('Cleaning build directory: %s', config.builddir)
    cleanDirectory(config.builddir)


def main(args):
    # Script is assumed to live in the root of the project
    # directory.
    rootdir = os.path.dirname(args[0])
    if rootdir and rootdir != '.':
        os.chdir(rootdir)
    config = getConfig(args)
    prepareBuildDir(config)
    preprocessSite(config)
    if config.validate:
        validateSiteSchema(config)
    prepareDistDir(config)
    buildSite(config)
    return 0


if __name__ == '__main__':
    rv = main(sys.argv)
    sys.exit(rv)
