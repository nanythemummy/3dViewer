import logging
import os
import subprocess

from .config import Config

log = logging.getLogger(__name__)


class XMLToolbox:
    """An interface to external tools doing XML validation and XSL transformations."""

    def __init__(self, config: Config):
        self.verbose = config.verbose
        self.builddir = config.builddir
        self.sourcedir = config.sourcedir
        self.stylesheetdir = config.stylesheetdir
        self.verbose = config.verbose
        self.java = config.javapath
        self.saxon = config.saxonjarpath
        self.xmlstarlet = config.xmlstarletpath
        self.buildsite = config.buildsitejarpath

    def transformSite(self):
        """Use a Java tool to transform all the site and page XML to HTML.

        We're using our own tool to run all of the XSLT processing in one
        program run, for much better performance than if we ran them through
        the Saxon CLI one at a time.
        """
        cmd = [self.java, '-jar', self.buildsite]
        subprocess.run(cmd, check=True)

    def transform(self, stylesheet, src, dest, includes=False):
        """Use XSLT to transform one input file to an output file.

        Note that XSLT enables additional output to be written on the side.

        We use the Saxon XSLT processor, which supports the latest and greatest
        version of XSLT. If includes=True, we splice in XIncludes if they are present.
        """
        description = stylesheet
        if includes:
            description += ', with XIncludes'
        log.debug('Transform: %s -> (%s) -> %s', src, description, dest)
        cmd = ['java', '-jar', 'tools/saxon-he-12.3.jar', '-xsl:' + stylesheet, '-s:' + src, '-o:' + dest]
        if includes:
            cmd.append('-xi')
        if self.verbose:
            cmd.append('verbose=true')
        destdir = os.path.dirname(dest)
        if destdir:
            cmd.append('destdir=' + destdir)
        subprocess.run(cmd, check=True)

    def validateSchema(self, schema, target):
        """Use XML Schema to validate an XML file.

        We use XML Starlet for this, as Saxon only includes schema validation with
        the paid version of their tool.
        """
        log.debug('Validating XML against schema %s: %s', schema, target)
        subprocess.run([self.xmlstarlet, 'val', '-q', '-e', '-s', schema, target], check=True)

    def validate(self, target):
        """Check an XML file for well-formedness.

        We use XML Starlet for this for convenience.
        """
        log.debug('Validating well-formed XML: %s', target)
        subprocess.run([self.xmlstarlet, 'val', '-q', '-e', target], check=True)
