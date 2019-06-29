<?xml version="1.0" encoding="utf-8"?>
<xsl:stylesheet version="3.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  <xsl:output method="html" indent="yes" version="5.0"/>

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
        <script src="js/three.min.js"/>
        <script src="js/loaders/GLTFLoader.js"/>
        <script src="js/controls/OrbitControls.js"/>
        <script src = "js/main.js"/>
        <xsl:apply-templates select="model" mode="codegen"/>
      </body>
    </html>
  </xsl:template>

  <xsl:template match="model" mode="codegen">
    <script>
      const gController = new ModelController('<xsl:value-of select="@dest"/>');
      gController.run();
    </script>
  </xsl:template>
</xsl:stylesheet>
