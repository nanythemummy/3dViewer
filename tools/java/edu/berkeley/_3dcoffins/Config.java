package edu.berkeley._3dcoffins;

import java.io.File;
import java.io.IOException;
import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;
import javax.xml.parsers.ParserConfigurationException;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.Node;
import org.w3c.dom.NodeList;
import org.xml.sax.SAXException;

/**
 * Configuration for BuildSite.
 */
public class Config {
    public File sourcedir;
    public File builddir;
    public File distdir;
    public File buildsitexml;
    public File distindexhtml;
    public File site2html;
    public File page2html;

    /**
     * Find the one and only descendent element with the given name.
     *
     * @throws ConfigException if there isn't exactly one such element
     */
    static Element getDocumentElementByTagName(Document node, String tagName) throws ConfigException {
        NodeList elems = node.getElementsByTagName(tagName);
        if (elems.getLength() == 0) {
            throw new ConfigException("Couldn't find element: " + tagName);
        } else if (elems.getLength() > 1) {
            throw new ConfigException("More than one element: " + tagName);
        }
        return (Element) elems.item(0);
    }

    /**
     * Find the one and only descendent element with the given name.
     *
     * Note: this is identical to getDocumentElementByTagName, but there
     * is no common interface or base class that we can use to merge
     * these functions together.
     *
     * @throws ConfigException if there isn't exactly one such element
     */
    static Element getSubelementByTagName(Element node, String tagName) throws ConfigException {
        NodeList elems = node.getElementsByTagName(tagName);
        if (elems.getLength() == 0) {
            throw new ConfigException("Couldn't find element: " + tagName);
        } else if (elems.getLength() > 1) {
            throw new ConfigException("More than one element: " + tagName);
        }
        return (Element) elems.item(0);
    }

    /**
     * Find the one and only descendent element with the given name.
     * Assume it is a simple text-valued element that represents a
     * file path. Return the File corresponding to the path.
     */
    static File getSubelementAsFile(Element node, String tagName) throws ConfigException {
        Element elem = Config.getSubelementByTagName(node, tagName);
        return new File(elem.getTextContent().trim());
    }

    /**
     * Load the config from an XML file.
     */
    static Config loadFromFile(File fileName) throws ConfigException {
        DocumentBuilder builder;
        Document configDoc;
        try {
            builder = DocumentBuilderFactory.newInstance().newDocumentBuilder();
            configDoc = builder.parse(fileName);
        } catch (ParserConfigurationException e) {
            throw new ConfigException("Couldn't initialize XML parser", e);
        } catch (IOException e) {
            throw new ConfigException("Couldn't find config: " + fileName.toString(), e);
        } catch (SAXException e) {
            throw new ConfigException("Couldn't parse config: " + fileName.toString(), e);
        }

        Element site = Config.getDocumentElementByTagName(configDoc, "site");
        Config config = new Config();
        config.sourcedir = Config.getSubelementAsFile(site, "sourcedir");
        config.builddir = Config.getSubelementAsFile(site, "builddir");
        config.distdir = Config.getSubelementAsFile(site, "distdir");
        config.buildsitexml = Config.getSubelementAsFile(site, "buildsitexml");
        config.distindexhtml = Config.getSubelementAsFile(site, "distindexhtml");
        config.site2html = Config.getSubelementAsFile(site, "site2html");
        config.page2html = Config.getSubelementAsFile(site, "page2html");
        return config;
    }
}
