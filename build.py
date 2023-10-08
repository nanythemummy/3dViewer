#!/usr/bin/env python3

# build.py builds the 3dViewer site from site structure
# defined in site.xml and included files, as well as
# build rules defined here.

from dataclasses import dataclass
import logging
import os
import shutil
import sys
import xml.etree.ElementTree as ET

import tools.build.config
import tools.build.convertTransliteration
import tools.build.xmltoolbox


logging.basicConfig(level=logging.INFO, stream=sys.stdout, format='%(levelname)s: %(message)s')
log = logging.getLogger(__name__)


@dataclass
class Context:
    config: tools.build.config.Config
    toolbox: tools.build.xmltoolbox.XMLToolbox


def expandPath(ctx, path):
    """Expand any magic variables in source paths."""
    path = path.replace('${assets}', ctx.config.assetsdir)
    return os.path.abspath(path)


def loadSite(ctx):
    """Load the site's XML definition.

    Assumes the site XML has been preprocessed.
    """
    log.debug('Loading site: %s', ctx.config.sitexml)
    site = ET.parse(ctx.config.fullsitexml).getroot()
    site.attrib['src'] = ctx.config.fullsitexml
    return site


def copyElementAsset(ctx, elem):
    """Copy a asset, represented by an XML element, to the output directory."""
    src = expandPath(ctx, elem.attrib['src'])
    dest = os.path.join(ctx.config.distdir, elem.attrib['dest'])
    log.debug('Copying asset: %s -> %s', src, dest)
    shutil.copy(src, dest)


def copyAssets(ctx):
    """Copy all assets to the output directory."""
    site = loadSite(ctx)

    # Most of our assets can just be copied over wholesale from
    # the static directory.
    log.info('Copying static assets...')
    staticdir = 'static'
    for item in os.listdir(staticdir):
        src = os.path.join(staticdir, item)
        dest = os.path.join(ctx.config.distdir, item)
        if os.path.isdir(src):
            log.debug('Copying directory: %s -> %s', src, dest)
            shutil.copytree(src, dest)
        else:
            log.debug('Copying: %s -> %s', src, dest)
            shutil.copy(src, dest)

    #there may be several first party javascript files in the dist directory.
    #scoop those up and copy them over.
    log.info('Copying first-party Javascript sources...')
    listjs = [fl for fl in os.listdir('src') if os.path.splitext(fl)[1]=='.js']
    for item in listjs:
        shutil.copy(os.path.join('src', item), os.path.join(ctx.config.distdir, 'js', item))
    
    log.info('Copying model assets...')
    # Models could in theory be copied wholesale from our assets
    # repository, but I'll do a somewhat more streamlined path and
    # follow model definitions to figure out which models are
    # actually needed.
    modelsdestdir = os.path.join(ctx.config.distdir, 'models')

    os.makedirs(modelsdestdir)
    for model in site.findall('.//model'):
        copyElementAsset(ctx, model)

    log.info('Copying hieroglyphic image assets...')
    imgdestdir = os.path.join(ctx.config.distdir, 'img')
    if not os.path.exists(imgdestdir):
        os.makedirs(imgdestdir)
    for himg in site.findall('.//himg'):
        copyElementAsset(ctx, himg)


def convertTransliteration(src, dest):
    """Convert transliterations from MdC to Unicode."""
    log.info('Converting transliterations from MdC to Unicode...')
    log.debug('Tlit transform: %s -> %s', src, dest)
    with open(dest, 'w') as outfile:
        with open(src) as infile:
            tools.build.convertTransliteration.transform(infile, outfile)


def buildSite(ctx):
    """Build the entire site.

    Assumes the site XML has been preprocessed.
    Assets are copied to the output directory wholesale.
    Transliterations are converted to Unicode.
    Finally, HTML is generated from the site XML.
    We use XSLT as defined by site2html.xsl to do the transformation.
    """
    copyAssets(ctx)

    tlitfname = os.path.join(ctx.config.builddir, 'site.transliterated.xml')
    convertTransliteration(src=ctx.config.fullsitexml, dest=tlitfname)

    log.info('Building site HTML...')
    indexdest = os.path.join(ctx.config.distdir, 'index.html')
    xslpath = os.path.join(ctx.config.stylesheetdir, 'site2html.xsl')
    ctx.toolbox.transform(stylesheet=xslpath, src=tlitfname, dest=indexdest)


def validateSiteSchema(ctx):
    """Validate that our site XML matches our custom schema.

    Assumes site.xml has been preprocessed.
    """
    log.info('Validating site XML against schema...')
    schemafname = os.path.join(ctx.config.schemadir, 'site.xsd')
    ctx.toolbox.validateSchema(schema=schemafname, target=ctx.config.fullsitexml)


def assembleSite(ctx):
    """Process XIncludes in site.xml, writing the results to dest.

    This is so that future steps have a fully-expanded site.xml to
    work with, and don't have to worry about pulling in the page XML.
    """
    log.info('Processing XML includes in site XML...')
    log.debug('Assembling: %s', ctx.config.fullsitexml)
    # Transforming with identity.xsl has the effect of simply pulling in
    # XIncludes and nothing else.
    xslpath = os.path.join(ctx.config.stylesheetdir, 'identity.xsl')
    ctx.toolbox.transform(stylesheet=xslpath, src=ctx.config.sitexml, dest=ctx.config.fullsitexml, includes=True)


def extractIncludes(ctx, source):
    """Preprocess the source XML to a text file containing just includes.

    The source XML is assumed to be well-formed.
    """
    outputfname, _ = os.path.splitext(os.path.basename(source))
    outputfname += '_includes.txt'
    outputpath = os.path.join(ctx.config.builddir, outputfname)
    xslpath = os.path.join(ctx.config.stylesheetdir, 'includes.xsl')
    ctx.toolbox.transform(stylesheet=xslpath, src=source, dest=outputpath)
    return outputpath


def validateXMLAndIncludes(ctx, source):
    """Check that the source XML and its includes are well-formed."""
    sourcedir = os.path.dirname(source)
    ctx.toolbox.validate(source)
    includespath = extractIncludes(ctx, source)
    with open(includespath, 'r') as includes:
        for include in includes:
            include = include.strip()
            if not include:
                continue
            include = os.path.join(sourcedir, include)
            if not os.path.isfile(include):
                raise RuntimeError('Unable to locate included file: {}'.format(include))
            validateXMLAndIncludes(ctx, include)


def preprocessSite(ctx):
    log.info('Preprocessing site XML...')
    if ctx.config.validate:
        validateXMLAndIncludes(ctx, ctx.config.sitexml)
    assembleSite(ctx)


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


def prepareDistDir(ctx):
    """Clean the output directory, or create it if it doesn't exist."""
    if not os.path.exists(ctx.config.distdir):
        log.info('Creating dist directory: %s', ctx.config.distdir)
        os.makedirs(ctx.config.distdir)
        return

    log.info('Cleaning dist directory: %s', ctx.config.distdir)
    cleanDirectory(ctx.config.distdir)


def prepareBuildDir(ctx):
    """Clean the intermediate build directory, or create it if it doesn't exist."""
    if not os.path.exists(ctx.config.builddir):
        log.info('Creating build directory: %s', ctx.config.builddir)
        os.makedirs(ctx.config.builddir)
        return

    log.info('Cleaning build directory: %s', ctx.config.builddir)
    cleanDirectory(ctx.config.builddir)


def main(args):
    # Script is assumed to live in the root of the project
    # directory.
    rootdir = os.path.dirname(args[0])
    if rootdir and rootdir != '.':
        os.chdir(rootdir)
    config = tools.build.config.getConfig(args)
    if config.verbose:
        log.setLevel(logging.DEBUG)
    toolbox = tools.build.xmltoolbox.XMLToolbox(config)
    ctx = Context(config=config, toolbox=toolbox)
    prepareBuildDir(ctx)
    preprocessSite(ctx)
    if config.validate:
        validateSiteSchema(ctx)
    prepareDistDir(ctx)
    buildSite(ctx)
    return 0


if __name__ == '__main__':
    rv = main(sys.argv)
    sys.exit(rv)
