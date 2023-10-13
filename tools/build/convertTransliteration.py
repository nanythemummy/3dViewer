"""convertTransliteration transforms a page XML to an augmented page XML,
finding all Manuel de Codage transliterations in the document (convenient for
authoring) and adding their Unicode equivalents (convenient for web display).

This is a copy and adaptation of CTLK's MdC to Unicode conversion, authored
by Doğu Kaan Eraslan <kaaneraslan@gmail.com> and released under a MIT license
(see https://github.com/cltk/cltk/blob/master/LICENSE ). It is reproduced
here for performance reasons – importing CLTK is expensive!
"""

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
            self.text = ''

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
