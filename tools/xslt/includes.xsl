<?xml version="1.0" encoding="utf-8"?>
<!--
  includes.xsl is used to extract all the XIncludes from a
  given XML document.
-->
<xsl:stylesheet
        version="1.0"
        xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
        xmlns:xi="http://www.w3.org/2001/XInclude" >
    <xsl:output method="text"/>
    <!-- Skip all text (including whitespace). -->
    <xsl:template match="text()"/>
    <!-- Report each XInclude... -->
    <xsl:template match="xi:include">
        <xsl:value-of select="@href"/>
        <!-- ...followed by a newline. -->
        <xsl:text>&#xA;</xsl:text>
    </xsl:template>
</xsl:stylesheet>
