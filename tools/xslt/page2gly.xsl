<?xml version="1.0" encoding="utf-8"?>
<xsl:stylesheet version="3.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  <!--
    This is a proof-of-concept stylesheet for generating GLY (JSesh source)
    files from our XML pages.

    Note that, to get the text format just right, I'm very particular with the
    whitespace inside the templates, and the newlines are significant!

    Example use:
      saxon -xsl:tools/xslt/page2gly.xsl -s:src/iwefaa.xml -o:iwefaa.gly
  -->
  <xsl:output method="text" indent="no" omit-xml-declaration="yes"/>

  <!-- This prelude was cribbed from iwefaa-complete-texts.gly -->
  <xsl:template match="texts" xml:space="preserve">++JSesh_Info 1.0 +s
++JSesh_use_lines_for_shading true +s
++JSesh_max_quadrant_width 22.0 +s
++JSesh_line_skip 6.0 +s
++JSesh_small_skip 2.0 +s
++JSesh_column_skip 10.0 +s
++JSesh_standard_sign_height 18.0 +s
++JSesh_small_body_scale_limit 12.0 +s
++JSesh_cartouche_line_width 1.0 +s
++JSesh_small_sign_centered true +s
++JSesh_page_direction LEFT_TO_RIGHT +s
++JSesh_max_quadrantHeight 18.0 +s
++JSesh_page_orientation HORIZONTAL +s

<xsl:apply-templates/>
</xsl:template>

  <xsl:template match="desc" xml:space="preserve">+b <xsl:value-of select="."/>+s-!
</xsl:template>

  <xsl:template match="hi[@encoding='mdc-jsesh']" xml:space="preserve">+l <xsl:number format="1)" level="multiple" from="texts" count="text|frag"/> +s-<xsl:value-of select="."/>-!
</xsl:template>

  <xsl:template match="al[@encoding='mdc']" xml:space="preserve">+t <xsl:value-of select="."/>+s-!
</xsl:template>

  <xsl:template match="tr" xml:space="preserve">+l <xsl:value-of select="."/>+s-!
</xsl:template>

  <!-- Suppress all other whitespace and text output -->
  <xsl:template match="text()"/>
</xsl:stylesheet>
