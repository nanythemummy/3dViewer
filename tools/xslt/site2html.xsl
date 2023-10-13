<?xml version="1.0" encoding="utf-8"?>
<xsl:stylesheet version="3.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:xs="http://www.w3.org/2001/XMLSchema"
  xmlns:j="http://www.w3.org/2005/xpath-functions">
  <!--
    site2html.xsl generates index.html from site.xml.
  -->

  <xsl:output method="html" indent="yes" version="5.0"/>
  <xsl:param name="verbose" as="xs:boolean" required="no">false</xsl:param>
  <xsl:param name="srcdir" as="xs:string" required="yes"/>
  <xsl:param name="destdir" as="xs:string" required="yes"/>

  <xsl:template match="site">
    <html>
      <head>
        <title>The Book of the Dead in 3D</title>
        <meta description = "Translations of texts on 3D models of coffins."></meta>
      </head>
      <body>
        <div class = "main-contents">
          <ul>
            <xsl:for-each select="page">
              <xsl:variable name="src" select="concat($srcdir, '/', @href)"/>
              <xsl:variable name="doc" select="document($src)"/>
              <xsl:variable name="dest" select="$doc/page/@dest"/>
              <xsl:variable name="destpath" select="concat($destdir, '/', $dest)"/>
              <xsl:variable name="pageName" select="$doc/page/name"/>
              <li><a href="{$dest}"><xsl:value-of select="$pageName"/></a></li>
            </xsl:for-each>
          </ul>
        </div>
      </body>
    </html>
  </xsl:template>
</xsl:stylesheet>
