package edu.berkeley._3dcoffins;

import java.io.File;
import java.io.IOException;
import java.nio.file.Paths;
import java.util.List;
import java.util.ArrayList;
import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;
import javax.xml.parsers.ParserConfigurationException;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.NodeList;
import org.xml.sax.SAXException;

/**
 * Loads Pages.
 */
class PageFactory {
    private Config config;
    private DocumentBuilder builder;

    public PageFactory(Config config) {
        this.config = config;
    }

    private DocumentBuilder getDocumentBuilder() throws BuildException {
        if (builder == null) {
            try {
                builder = DocumentBuilderFactory.newInstance().newDocumentBuilder();
            } catch (ParserConfigurationException e) {
                throw new BuildException("Couldn't initialize XML parser", e);
            }
        }
        return builder;
    }

    private Document loadSite() throws BuildException {
        Document siteDoc;
        File site = config.buildsitexml;
        try {
            siteDoc = getDocumentBuilder().parse(site);
        } catch (IOException e) {
            throw new BuildException("Couldn't find site XML: " + site.toString(), e);
        } catch (SAXException e) {
            throw new BuildException("Couldn't parse site XML: " + site.toString(), e);
        }
        return siteDoc;
    }

    private Page loadPage(String href) throws BuildException {
        Document pageDoc;
        File page = MorePaths.resolve(config.builddir, href);
        try {
            pageDoc = getDocumentBuilder().parse(page);
        } catch (IOException e) {
            throw new BuildException("Couldn't find page XML: " + page.toString(), e);
        } catch (SAXException e) {
            throw new BuildException("Couldn't parse page XML: " + page.toString(), e);
        }
        String dest = pageDoc.getDocumentElement().getAttribute("dest");
        return new Page(config, href, dest);
    }

    /**
     * Loads all the pages we need to build, and returns a list of them.
     * It loads them from the build/ directory, so assumes we have
     * already processed transliterations.
     *
     * @throws BuildException if any of the pages failed to load, or if
     *   we were unable to configure the XML parser.
     */
    public List<Page> getSitePages() throws BuildException {
        DocumentBuilder builder;
        Document siteDoc = loadSite();
        List<Page> pages = new ArrayList<>();
        NodeList elems = siteDoc.getElementsByTagName("page");
        for (int i = 0; i < elems.getLength(); i++) {
            Element elem = (Element) elems.item(i);
            String href = elem.getAttribute("href");
            pages.add(loadPage(href));
        }
        return pages;
    }
}
