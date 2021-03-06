<?xml version="1.0" encoding="utf-8"?>
<xsl:stylesheet
        version="3.0"
        xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
        xmlns:xs="http://www.w3.org/2001/XMLSchema"
        xmlns:j="http://www.w3.org/2005/xpath-functions" >
  <!--
    site2html.xsl generates the entire site's HTML from
    the source XML.

    The primary output of this document is a barebones
    index.html that links to all the pages in the site.
    For each link, the page it points to is generated as a
    side effect using xsl:result-document.
  -->

  <xsl:output method="html" indent="yes" version="5.0"/>
  <xsl:param name="verbose" as="xs:boolean" required="no">false</xsl:param>
  <xsl:param name="destdir" as="xs:string" required="no"/>
  <xsl:template match="site">
    <html>
      <head>
        <title>3D Coffins</title>
      </head>
      <body>
        <ul>
          <xsl:apply-templates/>
        </ul>
      </body>
    </html>
  </xsl:template>

  <xsl:template match="page">
    <!--- Generate the link for index.html -->
    <li><a href="{@dest}"><xsl:value-of select="name"/></a></li>

    <!--- On the side, generate the page itself, e.g. iwefaa.html -->
    <xsl:if test="$verbose">
      <xsl:message>
        <xsl:text>DEBUG: XSLT generating page: </xsl:text>
        <xsl:choose>
          <xsl:when test="$destdir">
            <xsl:value-of select="concat($destdir, '/', @dest)"/>
          </xsl:when>
          <xsl:otherwise>
            <xsl:value-of select="@dest"/>
          </xsl:otherwise>
        </xsl:choose>
      </xsl:message>
    </xsl:if>
    <xsl:result-document href="{@dest}">
      <xsl:apply-templates select="." mode="pagegen"/>
    </xsl:result-document>
  </xsl:template>

  <xsl:template match="page" mode="pagegen">
    <html>
      <head>
        <title><xsl:text disable-output-escaping="yes">3D Coffins <![CDATA[&ndash;]]> </xsl:text><xsl:value-of select="name"/></title>
        <link rel="stylesheet" type="text/css" href="css/viewer.css"/>
      </head>
      <body>
        <div id="left">
          <div id="loading"></div>
          <div id="viewer"></div>
        </div>
        <div id="right">
          <xsl:apply-templates select="texts"/>
        </div>
        <script src="js/three.min.js"/>
        <script src="js/loaders/GLTFLoader.js"/>
        <script src="js/controls/OrbitControls.js"/>
        <script src = "js/main.js"/>
        <xsl:apply-templates select="model" mode="codegen"/>
      </body>
    </html>
  </xsl:template>

  <xsl:template match="model" mode="codegen">
    <xsl:variable name="model-name">
      <j:string><xsl:value-of select="@dest"/></j:string>
    </xsl:variable>
    <xsl:variable name="model-links">
      <j:array>
        <xsl:apply-templates select="link" mode="codegen"/>
      </j:array>
    </xsl:variable>
    <script>
      const gModelName = <xsl:value-of select="xml-to-json($model-name)"/>;
      const gModelLinks = <xsl:value-of select="xml-to-json($model-links)"/>;
      const gController = new ModelController(gModelName, gModelLinks);
      gController.run();
    </script>
  </xsl:template>

  <xsl:template match="link" mode="codegen">
    <j:map>
      <j:string key="name"><xsl:value-of select="@name"/></j:string>
      <j:string key="ref"><xsl:value-of select="@ref"/></j:string>
    </j:map>
  </xsl:template>

  <xsl:template match="texts">
    <h2>Texts</h2>
    <xsl:apply-templates/>
  </xsl:template>

  <xsl:template match="text">
    <div class="text" id="{@id}">
      <xsl:if test="not(./frag)">
        <a class="model-link" data-text-id="{@id}" href="#">
          <xsl:number format="1." level="multiple" from="texts" count="text|frag"/>
        </a>
      </xsl:if>
      <xsl:apply-templates/>
    </div>
  </xsl:template>

  <xsl:template match="frag">
    <div class="text-fragment" id="{@id}">
      <a class="model-link" data-text-id="{@id}" href="#">
        <xsl:number format="1." level="multiple" from="texts" count="text|frag"/>
      </a>
      <xsl:apply-templates/>
    </div>
  </xsl:template>

  <xsl:template match="himg">
    <div class="hi-container">
      <img class="hi" src="{@dest}"/>
    </div>
  </xsl:template>

  <xsl:template match="al[@encoding='unicode']">
    <p class="al">
      <xsl:copy-of select="node()"/>
    </p>
  </xsl:template>

  <xsl:template match="tr">
    <p class="tr" xml:lang="{@xml:lang}">
      <xsl:copy-of select="node()"/>
    </p>
  </xsl:template>

  <!-- Not currently used in HTML generation -->
  <xsl:template match="desc"/>
  <xsl:template match="hi"/>
  <xsl:template match="al[@encoding='mdc']"/>
</xsl:stylesheet>
