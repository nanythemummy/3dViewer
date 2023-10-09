<?xml version="1.0" encoding="utf-8"?>
<xsl:stylesheet version="3.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:xs="http://www.w3.org/2001/XMLSchema"
  xmlns:j="http://www.w3.org/2005/xpath-functions">
  <!--
    page2html.xsl generates a page from the page's source XML.
  -->

  <xsl:output method="html" indent="yes" version="5.0"/>
  <xsl:param name="verbose" as="xs:boolean" required="no">false</xsl:param>
  <xsl:param name="srcdir" as="xs:string" required="yes"/>
  <xsl:param name="destdir" as="xs:string" required="yes"/>

  <xsl:template match="page">
    <html>
      <head>
        <title>
          <xsl:text disable-output-escaping="yes">3D Coffins                                                                                                 <![CDATA[&ndash;]]></xsl:text>
          <xsl:value-of select="name"/>
        </title>
        <meta name="DC.Creator" value="{creator}"/>
        <link rel="schema.DC" href="http://purl.org/DC/elements/1.0/"/>
        <link rel="stylesheet" type="text/css" href="css/viewer.css"/>
      </head>
      <body>
        <div id="nav_container">
          <nav>
            <ul>
              <li>
                <button id="control_button" onclick="overlay_show()" alt="Control Help"></button>
              </li>
            </ul>
          </nav>
        </div>
        <!-- Eventually, these strings need to be placed somewhere where they can be localized.-->
        <div id="controls_overlay" onclick="overlay_hide()">
          <div id="controls_container">
            <h1>Controls</h1>
            <ul>

              <li>
                 Hold the Alt (Option on a mac) key and left-click an area to highlight a text and see its translation in the panel to the right.
              </li>

              <li>Left click and drag to rotate.</li>
              <li>
                Shift+click or right click and drag to pan right and left.
                The arrow keys on your keyboard will also pan.
              </li>
              <li>
                To dolly or zoom, you can use the middle mouse button,
              or you can pinch two fingers on your Mac mouse or trackpad.
              </li>
            </ul>
          </div>
        </div>
        <div id="left">
          <div id="loading"></div>
          <div id="viewer"></div>
        </div>
        <div id="right">
          <div id="right-top">
            <h1 class="page_title">
              <xsl:value-of select="name"/>
            </h1>
            <h4 class="author">
              <xsl:value-of select="creator" />
            </h4>
            <p>
              <xsl:apply-templates select="description"/>
            </p>
            <p>
              <xsl:apply-templates select="texts"/>
            </p>
          </div>
          <div id="right-bottom">
            <div id="footnotes">
              <xsl:apply-templates select="footnotes"/>
            </div>
          </div>
        </div>
        <script src="js/three.min.js"/>
        <script src="js/loaders/GLTFLoader.js"/>
        <script src="js/controls/OrbitControls.js"/>
        <script src = "js/main.js"/>
        <script src = "js/page.js" />
        <xsl:apply-templates select="model" mode="codegen"/>
      </body>
    </html>
  </xsl:template>

  <xsl:template match="model" mode="codegen">
    <xsl:variable name="model-name">
      <j:string>
        <xsl:value-of select="@dest"/>
      </j:string>
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
      <j:string key="name">
        <xsl:value-of select="@name"/>
      </j:string>
      <j:string key="ref">
        <xsl:value-of select="@ref"/>
      </j:string>
    </j:map>
  </xsl:template>

  <xsl:template match="description" mode="codegen">
    <h2>Description</h2>
    <xsl:apply-templates/>
  </xsl:template>

  <xsl:template match="contents">
    <xsl:apply-templates/>
  </xsl:template>

  <!-- Copy through certain HTML-like markup as-is -->
  <xsl:template match="p|div|a|em|span">
    <xsl:copy>
      <xsl:apply-templates/>
    </xsl:copy>
  </xsl:template>

  <xsl:template match="fnref">
    <a id="fnref{@num}" href="#fn{@num}" class="footnote-ref"><sup><xsl:value-of select="@num"/></sup></a>
  </xsl:template>

  <xsl:template match="footnotes">
    <h2>Notes</h2>
    <ul>
      <xsl:apply-templates/>
    </ul>
  </xsl:template>

  <xsl:template match="fn">
    <li id = "fn{@num}" class="footnote">
      <sup><xsl:value-of select="@num"/></sup><xsl:text> </xsl:text>
      <xsl:apply-templates/>
      <xsl:text> </xsl:text><a href="#fnref{@num}">&#8617;</a>
    </li>
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

  <xsl:template match="contents//al[@encoding='unicode']">
    <span class="al">
      <xsl:apply-templates/>
    </span>
  </xsl:template>

  <xsl:template match="texts//al[@encoding='unicode']">
    <p class="al">
      <xsl:apply-templates/>
    </p>
  </xsl:template>

  <xsl:template match="tr">
    <p class="tr" xml:lang="{@xml:lang}">
      <xsl:apply-templates/>
    </p>
  </xsl:template>

  <!-- Not currently used in HTML generation -->
  <xsl:template match="desc"/>
  <xsl:template match="hi"/>
  <xsl:template match="al[@encoding='mdc']"/>
</xsl:stylesheet>
