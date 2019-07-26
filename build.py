#!/usr/bin/env python3

# build.py builds the 3dViewer site from site structure
# defined in site.xml and included files, as well as
# build rules defined here.

import argparse
import os
import shutil
import subprocess
import sys
import tempfile
import xml.etree.ElementTree as ET
from xml.etree import ElementInclude


def expandPath(config, path):
    """Expand any magic variables in source paths."""
    path = path.replace('${assets}', config.assetsdir)
    return os.path.abspath(path)


def pageIncludeLoader(href, parse, encoding=None):
    """Load a document included by XInclude.

    We augment the default functionality by resolving all hrefs relative to the
    src directory. This is what Saxon does when processing those files, and it's
    what we expect. Doing it this way means we can leave our working directory
    untouched, so that other parts of our build script can work relative to the
    project root.
    """
    return ElementInclude.default_loader(os.path.join('src', href), parse, encoding)


def loadSite(config):
    """Load the site's XML definition."""
    print('Loading site: {}'.format(config.sitexml))
    site = ET.parse(config.sitexml).getroot()
    # The site includes our pages. Use ElementInclude to splice them
    # into our element tree. Note the use of a custom XML loader,
    # explained above.
    ElementInclude.include(site, loader=pageIncludeLoader)
    site.attrib['src'] = config.sitexml
    return site


def xslTransform(config, stylesheet, src, dest):
    """Use XSLT to transform an XML file to an output file.

    We use the Saxon XSLT processor, which supports the latest and greatest
    version of XSLT. We splice in XIncludes if they are present.
    """
    subprocess.run([config.saxonpath, '-xsl:' + stylesheet, '-s:' + src, '-o:' + dest, '-xi'], check=True)


def xmlSchemaValidate(config, schema, target):
    """Use XML Schema to validate an XML file.

    We use XML Starlet for this, as Saxon only includes schema validation with
    the paid version of their tool.
    """
    subprocess.run([config.xmlstarletpath, 'val', '-q', '-e', '-s', schema, target], check=True)


def copyModel(config, model):
    """Copy the given model asset to the output directory.

    The model is assumed to be an element with attributes that indicate the
    source and destination.
    """
    modelsrc = expandPath(config, model.attrib['src'])
    modeldest = os.path.join(config.distdir, model.attrib['dest'])
    print('Copying {} to {}'.format(modelsrc, modeldest))
    shutil.copy(modelsrc, modeldest)


def copyAssets(config, site):
    """Copy all static assets to the output directory.

    The site is assumed to be a loaded site element.
    """
    print('Copying static assets')
    # Most of our assets can just be copied over wholesale from
    # the static directory.
    staticdir = 'static'
    for item in os.listdir(staticdir):
        src = os.path.join(staticdir, item)
        dest = os.path.join(config.distdir, item)
        if os.path.isdir(src):
            shutil.copytree(src, dest)
        else:
            shutil.copy(src, dest)

    # This is awkward: I have main.js in src/ to distinguish it from
    # third-party code, but I want to treat it as a static asset for
    # now! Just handle this case specially.
    shutil.copy(os.path.join('src', 'main.js'), os.path.join(config.distdir, 'js', 'main.js'))

    print('Copying models')
    # Models could in theory be copied wholesale from our assets
    # repository, but I'll do a somewhat more streamlined path and
    # follow model definitions to figure out which models are
    # actually needed.
    modelsdestdir = os.path.join(config.distdir, 'models')
    os.makedirs(modelsdestdir)
    for model in site.findall('.//model'):
        copyModel(config, model)


def buildSite(config):
    """Build the entire site.

    Assets are copied to the ouptut directory wholesale.
    HTML is generated from a site.xml and one or more page XML files
    pulled in by site.xml. We use XSLT as defined by site2html.xsl and
    page2html.xsl to do the transformation.
    """
    site = loadSite(config)
    copyAssets(config, site)

    print('Building site HTML...')
    indexsrc = site.attrib['src']
    indexdest = os.path.join(config.distdir, 'index.html')
    xslTransform(config, stylesheet=os.path.join('tools', 'xslt', 'site2html.xsl'), src=indexsrc, dest=indexdest)


def validateSite(config):
    """Validate that the site XML matches our custom schema."""
    fd, tempfname = tempfile.mkstemp(prefix='site.', suffix='.xml')
    os.close(fd)
    print('Validating site XML...')
    # Transforming with identity.xsl has the effect of simply pulling in
    # XIncludes and nothing else.
    xslTransform(config, stylesheet=os.path.join('tools', 'xslt', 'identity.xsl'), src=config.sitexml, dest=tempfname)
    schemafname = os.path.join('src', 'schema', 'site.xsd')
    xmlSchemaValidate(config, schema=schemafname, target=tempfname)
    os.unlink(tempfname)


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
    parser.add_argument('--assetsdir', help='where model assets are stored', default='../assets')
    parser.add_argument('--distdir', help='where build output is written', default='dist')
    parser.add_argument('--sitexml', help='location of site XML definition', default='src/site.xml')
    parser.add_argument('--saxonpath', help='location of Saxon XSLT processor')
    parser.add_argument('---xmlstarletpath', help='location of XML Starlet, used for XML Include/Schema processing')
    parser.add_argument('--no-val', dest='validate', action='store_false', help='Skip XML validation step', default=True)
    config = parser.parse_args(args[1:])
    if config.distdir == '/':
        # We're going to blow away the output directory before writing to it,
        # so we ought to be at least a little careful here!
        parser.error('Cannot set dist directory to root!')
    try:
        resolveToolLocation(config, 'saxonpath', 'saxon')
    except NoSuchTool:
        parser.error('Saxon not found. Install Saxon with Homebrew or specify the location of the executable using --saxonpath.')
    try:
        resolveToolLocation(config, 'xmlstarletpath', 'xmlstarlet')
    except NoSuchTool:
        parser.error('XML Starlet not found. Install XML Starlet with Homebrew or specify the location of the executable using --xmlstarletpath.')

    return config


def prepareDistDir(config):
    """Clean the output directory, or create it if it doesn't exist."""
    if not os.path.exists(config.distdir):
        print('Creating dist directory: {}'.format(config.distdir))
        os.makedirs(config.distdir)
        return

    print('Cleaning dist directory: {}'.format(config.distdir))
    # Don't just use shutil.rmtree on config.distdir and recreate it --
    # development servers like Python's SimpleHTTPServer will not switch to the
    # new directory. Instead, just clear out its contents.
    for root, dirs, files in os.walk(config.distdir):
        for f in files:
            os.unlink(os.path.join(root, f))
        for d in dirs:
            shutil.rmtree(os.path.join(root, d))


def main(args):
    os.chdir(os.path.dirname(args[0]))
    config = getConfig(args)
    if config.validate:
      validateSite(config)
    prepareDistDir(config)
    buildSite(config)


if __name__ == '__main__':
    rv = main(sys.argv)
    sys.exit(rv)
