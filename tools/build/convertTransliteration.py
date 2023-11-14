"""convertTransliteration transforms a page XML to an augmented page XML,
finding all Manuel de Codage transliterations in the document (convenient for
authoring) and adding their Unicode equivalents (convenient for web display).

This is a copy and adaptation of CTLK's MdC to Unicode conversion, authored
by Doğu Kaan Eraslan <kaaneraslan@gmail.com> and released under a MIT license
(see https://github.com/cltk/cltk/blob/master/LICENSE ). It is reproduced
here for performance reasons – importing CLTK is expensive!
"""

import io
import re
import sys
from xml import sax
from xml.sax import saxutils


def mdcToUnicode(string, q_kopf=True):
    """
    Convert the given MdC transliteration to Unicode text.

    This reproduces CLTK's transliteration mapping and code
    (cltk.alphabet.egy.mdc_unicode),  but chooses an alternative
    representation for Yod (i and I) that displays a bit nicer in our
    opinion.

    There are, as of Mar 2019, new canonical Unicode characters for
    these that we should be using, but the fonts haven't quite caught
    up yet.

    If q_kopf is True, we retain the use of q and Q; otherwise we use
    ḳ and Ḳ.
    """

    # lettres miniscules/lower case letters/küçük harfler
    alef = string.replace("\u0041", "\ua723")  # A -> ꜣ
    ayin = alef.replace("\u0061", "\ua725")  # a -> ꜥ
    h_dot = ayin.replace("\u0048", "\u1e25")  # H -> ḥ
    h_breve = h_dot.replace("\u0078", "\u1e2b")  # x -> ḫ
    h_line = h_breve.replace("\u0058", "\u1e96")  # X -> ẖ
    h_circum_below = h_line.replace("\u0056", "\u0068" + "\u032d")  # V -> 
    shin = h_circum_below.replace("\u0053", "\u0161")  # S -> š
    s_acute = shin.replace("\u0063", "\u015b")  # c -> ś
    tche = s_acute.replace("\u0054", "\u1e6f")  # T -> ṯ
    t_circum_below = tche.replace("\u0076", "\u1e71")  # v -> ṱ
    djed = t_circum_below.replace("\u0044", "\u1e0f")  # D -> ḏ
    # LOWER CASE YOD
    # original: egy_yod = djed.replace("\u0069", "\u0069" + "\u0486")  # i -> i҆
    egy_yod = djed.replace("\u0069", "\u1ec9")  # i -> ỉ
    # END LOWEr CASE YOD
    equal = egy_yod.replace("\u003d", "\u2e17")  # = -> ⸗
    left_brackets = equal.replace("\u003c", "\u2329")  # < -> 〈
    right_brackets = left_brackets.replace("\u003e", "\u232a")  # > -> 〉

    if q_kopf is False:
        kopf = right_brackets.replace("\u0071", "\u1e33")  # q -> ḳ
        kopf_capital = kopf.replace("\u0051", "\u1e32")  # Q -> Ḳ
    else:
        kopf_capital = right_brackets

    # LETTRES MAJUSCULES/ UPPER CASE LETTERS/ BÜYÜK HARFLER
    h2_capital = re.sub("[\u00a1\u0040]", "\u1e24", kopf_capital)  # ¡|@ -> Ḥ
    h3_capital = re.sub("[\u0023\u00a2]", "\u1e2a", h2_capital)  # #|¢ -> Ḫ
    h4_capital = re.sub("[\u0024\u00a3]", "\u0048" + "\u0331", h3_capital)  # $|£ -> H̱
    shin_capital = re.sub("[\u00a5\u005e]", "\u0160", h4_capital)  # ¥|^ -> Š
    tche_capital = re.sub("[\u002a\u00a7]", "\u1e6e", shin_capital)  # *|§ -> Ṯ
    djed_capital = re.sub("[\u00a9\u002b]", "\u1e0e", tche_capital)  # ©|+ -> Ḏ
    # UPPER CASE YOD
    # original: not handled!
    egy_yod_capital = djed_capital.replace('\u0049', '\u1ec8')  # I -> Ỉ
    # END UPPER CASE YOD
    unicode_text = egy_yod_capital.replace("\u0043", "\u015a")  # C -> Ś

    return unicode_text


class Converter(saxutils.XMLGenerator):
    """A SAX processor that handles conversion of MdC transliterations.

    Specifically, it converts <al encoding="mdc">...</al> elements to
    <al encoding="unicode">...</al> elements, and writes the converted
    element immediately _after_ the MdC-encoded element. This preserves
    source information just in case.

    This inherits from XMLGenerator, so its base behavior is to copy
    everything to output I/O. Converter augments that behavior to add the
    Unicode transliterations alongside the MdC ones.

    The conversion will preserve all internal markup as-is, but assume
    all the text is MdC and convert it to Unicode. The conversion will
    generally span several SAX handler method calls. Here's how our
    implementation works:

    - When we start conversion, we create a StringIO to hold the converted
      markup. We also create a standalone XMLGenerator that wraps that
      StringIO, and we use it to copy, or write transformed, markup to the
      StringIO. Note that we don't use the full SAX interface when driving
      the standalone XML generator; we only use the part of it that is
      relevant to our conversion.
    - As we convert, we continue to process our XML output as normal, which
      copies data to the output.
    - As we see text that we want to convert, we concatenate it until we
      see something else (e.g. a start or end tag). We then convert the
      text all at once from MdC -> Unicode and write it to the standalone
      generator. We do this extra concatenation to make sure we don't
      have to worry about character sequence splits across chunks.
    - As we see other markup within the context of conversion, we copy it
      to the standalone XML generator by invoking the corresonding SAX
      handler methods on the standalone XML generator.
    - Once we have closed off the <al> tag that we were converting, we
      write the end of the tag as usual, then take all the work we did on
      the side to create the converted <al> element, collect it from the
      StringIO buffer, and immediately write that out.
    """
    def __init__(self, out):
        super(Converter, self).__init__(out, encoding='utf-8', short_empty_elements=True)
        self.indent = 0
        self.converting = False
        self.convert_io = None
        self.convert_gen = None
        self.convet_pending_text = None
        self.convert_begin_indent = None

    def _copyAttrsToDict(self, attrs):
        out_attrs = {}
        for k, v in attrs.items():
            out_attrs[k] = v
        return out_attrs

    def _copyStartElementToConversion(self, name, attrs):
        self._writePendingTextToConversion()
        self.convert_gen.startElement(name, attrs)

    def _copyStartElementWithNSToConversion(self, name, qname, attrs):
        self._writePendingTextToConversion()
        self.convert_gen.startElementNS(name, qname, attrs)

    def _copyEndElementToConversion(self, name):
        self._writePendingTextToConversion()
        self.convert_gen.endElement(name)

    def _copyEndElementWithNSToConversion(self, name, qname):
        self._writePendingTextToConversion()
        self.convert_gen.endElementNS(name, qname)

    def _writePendingTextToConversion(self):
        if not self.convert_pending_text:
            return
        converted = mdcToUnicode(self.convert_pending_text)
        self.convert_gen.characters(converted)
        self.convert_pending_text = None

    def _startConversion(self):
        self.converting = True
        self.convert_begin_indent = self.indent
        self.convert_io = io.StringIO()
        self.convert_gen = saxutils.XMLGenerator(
            out=self.convert_io, encoding=self._encoding, short_empty_elements=self._short_empty_elements
        )
        self.convert_gen._ns_contexts.append(self._current_context.copy())
        self.convert_pending_text = None

    def _endConversion(self):
        if self.converting:
            self.convert_gen._flush()
            output = self.convert_io.getvalue()
            if output:
                self._write(output)
        self.converting = False
        self.convert_begin_indent = None
        self.convert_io = None
        self.convert_gen = None
        self.convert_pending_text = None

    def startElement(self, name, attrs):
        super(Converter, self).startElement(name, attrs)
        self.indent += 1
        if name == 'al':
            if self.converting:
                raise RuntimeError("Can't nest an <al> element inside an <al> element")
            elif attrs.get('encoding') == 'mdc':
                self._startConversion()
                new_attrs = self._copyAttrsToDict(attrs)
                new_attrs['encoding'] = 'unicode'
                self._copyStartElementToConversion(name, new_attrs)
        elif self.converting:
            self._copyStartElementToConversion(name, attrs)

    def startElementNS(self, name, qname, attrs):
        super(Converter, self).startElementNS(name, qname, attrs)
        self.indent += 1
        if name[0] is None and name[1] == 'al':
            if self.converting:
                raise RuntimeError("Can't nest an <al> element inside an <al> element")
            elif attrs.get('encoding') == 'mdc':
                self._startConversion()
                new_attrs = self._copyAttrsToDict(attrs)
                new_attrs['encoding'] = 'unicode'
                self._copyStartElementWithNSToConversion(name, qname, new_attrs)
        elif self.converting:
            self._copyStartElementWithNSToConversion(name, qname, attrs)

    def endElement(self, name):
        super(Converter, self).endElement(name)
        if self.converting:
            self._copyEndElementToConversion(name)
            if self.indent == self.convert_begin_indent:
                self._endConversion()
        self.indent -= 1

    def endElementNS(self, name, qname):
        super(Converter, self).endElementNS(name, qname)
        if self.converting:
            self._copyEndElementWithNSToConversion(name, qname)
            if self.indent == self.convert_begin_indent:
                self._endConversion()
        self.indent -= 1

    def characters(self, data):
        super(Converter, self).characters(data)
        if self.converting:
            if self.convert_pending_text is None:
                self.convert_pending_text = data
            else:
                self.convert_pending_text += data

    def ignorableWhitespace(self, content):
        super(Converter, self).ignorableWhitespace(content)
        if self.converting:
            self._writePendingTextToConversion()
            self.convert_gen.ignorableWhitespace(content)

    def startPrefixMapping(self, prefix, url):
        if self.converting:
            self.convert_gen.startPrefixMapping(prefix, url)

    def endPrefixMapping(self, prefix):
        if self.converting:
            self.convert_gen.endPrefixMapping(prefix)


def transform(infile, outfile):
    handler = Converter(out=outfile)
    sax.parse(infile, handler)


def main(args):
    transform(sys.stdin, sys.stdout)
    return 0


if __name__ == '__main__':
    rv = main(sys.argv)
    sys.exit(rv)
