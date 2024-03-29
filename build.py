#!/usr/bin/env python3

"""
build.py builds the 3dViewer site.

It uses the site structure defined in site.xml and page XML files,
as well as the build rules defined here. Inputs come from src/,
static/, and a separate assets repo that has the 3D models and
hieroglyphic images.

We also have XSLT templates in tools/xslt that specify how the
output HTML is to be generated.

Subsidiary modules are in tools/build.
"""

import logging
import os
import shutil
import sys

import tools.build.cache
import tools.build.config
import tools.build.context
import tools.build.convertTransliteration
import tools.build.fileutil
import tools.build.site
import tools.build.xmltoolbox


logging.basicConfig(level=logging.INFO, stream=sys.stdout, format='%(levelname)s: %(message)s')
log = logging.getLogger(__name__)


def expandPath(ctx, path):
    """Expand any magic variables in source paths."""
    path = path.replace('${assets}', ctx.config.assetsdir)
    return os.path.abspath(path)


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
        if os.path.splitext(entry)[-1] != '.js':
            continue

        src = os.path.join(ctx.config.sourcedir, entry)
        dest = os.path.join(ctx.config.distdir, 'js', entry)
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
    for pagepath in tools.build.site.getPagePaths(ctx, ctx.config.sourcedir):
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
    convertTransliteration(src=ctx.config.srcsitexml, dest=ctx.config.buildsitexml)
    for page in tools.build.site.getPages(ctx):
        srcpage = os.path.join(ctx.config.sourcedir, page)
        destpage = os.path.join(ctx.config.builddir, page)
        convertTransliteration(src=srcpage, dest=destpage)


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
    ctx.toolbox.transformSite()


def preprocessPage(ctx, page):
    log.info('Preprocessing page: %s', page)
    if ctx.config.validate:
        ctx.toolbox.validate(page)
        ctx.toolbox.validateNGSchema(schema=ctx.config.ngpageschema, target=page)


def preprocessSite(ctx):
    log.info('Preprocessing site XML...')
    if ctx.config.validate:
        ctx.toolbox.validate(ctx.config.srcsitexml)
        ctx.toolbox.validateNGSchema(schema=ctx.config.ngsiteschema, target=ctx.config.srcsitexml)

    for page in tools.build.site.getSitePages(ctx):
        preprocessPage(ctx, page)


def prepareDistDir(ctx):
    """Clean the output directory, or create it if it doesn't exist."""
    if not os.path.exists(ctx.config.distdir):
        log.info('Creating dist directory: %s', ctx.config.distdir)
        os.makedirs(ctx.config.distdir, exist_ok=True)
        return

    log.info('Cleaning dist directory: %s', ctx.config.distdir)
    tools.build.fileutil.cleanDirectory(ctx.config.distdir)


def prepareBuildDir(ctx):
    """Clean the intermediate build directory, or create it if it doesn't exist."""
    if not os.path.exists(ctx.config.builddir):
        log.info('Creating build directory: %s', ctx.config.builddir)
        os.makedirs(ctx.config.builddir, exist_ok=True)
        return


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
    ctx = tools.build.context.Context(config=config, cache=cache, toolbox=toolbox)
    prepareBuildDir(ctx)
    preprocessSite(ctx)
    prepareDistDir(ctx)
    buildSite(ctx)
    return 0


if __name__ == '__main__':
    rv = main(sys.argv)
    sys.exit(rv)
