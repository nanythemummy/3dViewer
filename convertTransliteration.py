"""convertTransliteration transforms a page XML to an augmented page XML,
finding all Manuel de Codage transliterations in the document (convenient for
authoring) and adding their Unicode equivalents (convenient for web display).
"""

import sys
import xml.sax.handler
from xml import sax
from  xml.sax import saxutils

import cltk.corpus.egyptian.transliterate_mdc as tlit


def mdcToUnicode(s):
    """Convert the given MdC transliteration to Unicode text.

    This uses CLTK's transliteration function, but chooses an alternative
    representation for Yod (i and I) that displays a bit nicer in our
    opinion.
    
    There are, as of Mar 2019, new canonical Unicode characters for
    these, but the fonts haven't quite caught up yet.
    """
    return tlit.mdc_unicode(s).replace('\u0049\u0486', '\u1ec8').replace('\u0069\u0486', '\u1ec9')


# Hardcoded 2-space indent for now for pretty printing.
indent = '  '


class Converter(saxutils.XMLGenerator):
    """A SAX processor that handles conversion of MdC transliterations.

    This inherits from XMLGenerator, so its base behavior is to copy
    everything to output I/O. Converter augments that behavior to add the
    Unicode transliterations alongside the MdC ones. It attempts to
    pretty-print the inserted element.
    """
    def __init__(self, *args, **kwargs):
        super(Converter, self).__init__(*args, **kwargs)
        self.text = ''
        self.converting = False
        self.indentlevel = 0

    def startElement(self, name, attrs):
        if self.converting:
            raise RuntimeError('Converter expects no elements nested inside an <al> declaration')

        super(Converter, self).startElement(name, attrs)
        self.indentlevel += 1
        if name == 'al' and attrs.get('encoding') == 'mdc':
            self.converting = True
            self.txt = ''

    def characters(self, data):
        super(Converter, self).characters(data)
        if self.converting:
            # Convert everything at the end, to ensure our chunk doesn't break
            # up a multi-character Unicode sequence.
            self.text += data

    def endElement(self, name):
        super(Converter, self).endElement(name)
        self.indentlevel -= 1
        if self.converting:
            self._write('\n' + indent*self.indentlevel)
            converted = mdcToUnicode(self.text)
            self._write('<al encoding="unicode">{}</al>'.format(saxutils.escape(converted)))
            self.converting = False


def transform(infile, outfile):
    handler = Converter(out=outfile, encoding='utf-8', short_empty_elements=True)
    sax.parse(infile, handler)


def main(args):
    transform(sys.stdin, sys.stdout)
    return 0


if __name__ == '__main__':
    rv = main(sys.argv)
    sys.exit(rv)
