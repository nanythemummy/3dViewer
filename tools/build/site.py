import logging
import os

log = logging.getLogger(__name__)


def getPages(ctx):
    site = ctx.cache.load(ctx.config.srcsitexml)
    return (doc.attrib['href'] for doc in site.findall('.//page'))


def getPagePaths(ctx, dirname):
    return (os.path.join(dirname, page) for page in getPages(ctx))


def getSitePages(ctx):
    return (page for page in getPagePaths(ctx, ctx.config.sourcedir))
