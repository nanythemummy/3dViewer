#!/usr/bin/env python3

# build.py builds the 3dViewer site from site structure
# defined in site.xml and included files, as well as
# build rules defined here.

from dataclasses import dataclass
import logging
import os
import shutil
import sys

import tools.build.cache
import tools.build.config
import tools.build.convertTransliteration
import tools.build.xmltoolbox


logging.basicConfig(level=logging.INFO, stream=sys.stdout, format='%(levelname)s: %(message)s')
log = logging.getLogger(__name__)


@dataclass
class Context:
    config: tools.build.config.Config
    cache: tools.build.cache.XMLDocumentCache
    toolbox: tools.build.xmltoolbox.XMLToolbox


def expandPath(ctx, path):
    """Expand any magic variables in source paths."""
    path = path.replace('${assets}', ctx.config.assetsdir)
    return os.path.abspath(path)


def getPages(ctx):
    site = ctx.cache.load(ctx.config.sitexml)
    return (doc.attrib['href'] for doc in site.findall('.//page'))


def getPagePaths(ctx, dirname):
    return (os.path.join(dirname, page) for page in getPages(ctx))


def getSitePages(ctx):
    return (page for page in getPagePaths(ctx, ctx.config.sourcedir))


def copyElementAsset(ctx, elem):
    """Copy a asset, represented by an XML element, to the output directory."""
    src = expandPath(ctx, elem.attrib['src'])
    dest = os.path.join(ctx.config.distdir, elem.attrib['dest'])
    log.debug('Copying asset: %s -> %s', src, dest)
    shutil.copy(src, dest)


def copyStaticDirectoryAssets(ctx):
    log.info('Copying static assets...')
    for item in os.listdir(ctx.config.staticdir):
        src = os.path.join(ctx.config.staticdir, item)
        dest = os.path.join(ctx.config.distdir, item)
        if os.path.isdir(src):
            log.debug('Copying directory: %s -> %s', src, dest)
            shutil.copytree(src, dest)
        else:
            log.debug('Copying: %s -> %s', src, dest)
            shutil.copy(src, dest)


def copySourceDirectoryJavascript(ctx):
    log.info('Copying first-party Javascript sources...')
    for entry in os.listdir(ctx.config.sourcedir):
        if not os.path.splitext(entry)[0] == '.js':
            continue

        src = os.path.join(ctx.config.sourcedir, entry)
        dest = os.path.join(ctx.config.destdir, 'js', entry)
        log.debug('Copying %s -> %s', src, dest)
        shutil.copy(src, dest)


def copyAssetsMatchingElements(ctx, page, elementname):
    for elem in page.findall('.//' + elementname):
        copyElementAsset(ctx, elem)


def copyModelsReferencedFromPage(ctx, page):
    log.info('Copying models for %s...', page.attrib['src'])
    copyAssetsMatchingElements(ctx, page, 'model')


def copyHieroglyphImagesReferencedFromPage(ctx, page):
    log.info('Copying hieroglyphics for %s...', page.attrib['src'])
    copyAssetsMatchingElements(ctx, page, 'himg')


def copyAssets(ctx):
    """Copy all assets to the output directory."""
    # Most of our assets can just be copied over wholesale from
    # the static directory.
    copyStaticDirectoryAssets(ctx)

    # There may be several first party javascript files in the dist directory.
    # Scoop those up and copy them over.
    copySourceDirectoryJavascript(ctx)

    # Don't copy stuff from the assets directory wholesale.
    # Just copy whatever is referenced from the pages.
    os.makedirs(ctx.config.modelsdestdir, exist_ok=True)
    os.makedirs(ctx.config.imgdestdir, exist_ok=True)
    for pagepath in getPagePaths(ctx, ctx.config.sourcedir):
        page = ctx.cache.load(pagepath)
        copyModelsReferencedFromPage(ctx, page)
        copyHieroglyphImagesReferencedFromPage(ctx, page)


def convertTransliteration(src, dest):
    """Convert transliterations from MdC to Unicode."""
    log.info("Converting transliterations: %s -> %s", src, dest)
    with open(dest, 'w') as outfile:
        with open(src) as infile:
            tools.build.convertTransliteration.transform(infile, outfile)


def convertTransliterations(ctx):
    log.info("Converting transliterations from MdC to Unicode...")
    tlitfname = os.path.join(ctx.config.builddir, 'site.xml')
    convertTransliteration(src=ctx.config.sitexml, dest=tlitfname)
    for page in getPages(ctx):
        srcpage = os.path.join(ctx.config.sourcedir, page)
        destpage = os.path.join(ctx.config.builddir, page)
        convertTransliteration(src=srcpage, dest=destpage)


def getTransformParams(ctx):
    # Paths must be converted to absolute paths because Saxon reckons paths relative to the stylesheet
    srcdir = os.path.abspath(ctx.config.builddir)
    destdir = os.path.abspath(ctx.config.distdir)
    return {'srcdir': srcdir, 'destdir': destdir}


def buildIndex(ctx):
    log.info('Building index.html...')
    src = os.path.join(ctx.config.builddir, 'site.xml')
    dest = os.path.join(ctx.config.distdir, 'index.html')
    xsl = os.path.join(ctx.config.stylesheetdir, 'site2html.xsl')
    ctx.toolbox.transform(stylesheet=xsl, src=src, dest=dest, params=getTransformParams(ctx))


def buildPages(ctx):
    for page in getPages(ctx):
        log.info('Building %s', page)
        src = os.path.join(ctx.config.builddir, page)
        page = ctx.toolbox.cache.load(src)
        dest = os.path.join(ctx.config.distdir, page.attrib['dest'])
        xsl = os.path.join(ctx.config.stylesheetdir, 'page2html.xsl')
        ctx.toolbox.transform(stylesheet=xsl, src=src, dest=dest, params=getTransformParams(ctx))


def buildSite(ctx):
    """Build the entire site.

    Assumes the site XML has been preprocessed.
    Assets are copied to the output directory wholesale.
    Transliterations are converted to Unicode.
    Finally, HTML is generated from the site XML.
    We use XSLT as defined by site2html.xsl to do the transformation.
    """
    copyAssets(ctx)
    convertTransliterations(ctx)
    buildIndex(ctx)
    buildPages(ctx)


def preprocessPage(ctx, page):
    log.info('Preprocessing page: %s', page)
    if ctx.config.validate:
        ctx.toolbox.validate(page)
        ctx.toolbox.validateSchema(schema=ctx.config.pageschema, target=page)


def preprocessSite(ctx):
    log.info('Preprocessing site XML...')
    sitexml = ctx.config.sitexml
    if ctx.config.validate:
        ctx.toolbox.validate(sitexml)
        ctx.toolbox.validateSchema(schema=ctx.config.siteschema, target=sitexml)

    for page in getSitePages(ctx):
        preprocessPage(ctx, page)


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
    cache = tools.build.cache.XMLDocumentCache()
    toolbox = tools.build.xmltoolbox.XMLToolbox(config)
    ctx = Context(config=config, cache=cache, toolbox=toolbox)
    prepareBuildDir(ctx)
    preprocessSite(ctx)
    prepareDistDir(ctx)
    buildSite(ctx)
    return 0


if __name__ == '__main__':
    rv = main(sys.argv)
    sys.exit(rv)
