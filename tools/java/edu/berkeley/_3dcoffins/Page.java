package edu.berkeley._3dcoffins;

import java.io.File;
import java.io.IOException;
import java.util.List;
import java.util.ArrayList;
import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;
import javax.xml.parsers.ParserConfigurationException;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.NodeList;
import org.xml.sax.SAXException;

class Page {
    public String href;
    public String dest;

    public Page(String href, String dest) {
        this.href = href;
        this.dest = dest;
    }

    public static List<Page> getSitePages(File site) throws BuildException {
        DocumentBuilder builder;
        Document siteDoc;
        try {
            builder = DocumentBuilderFactory.newInstance().newDocumentBuilder();
            siteDoc = builder.parse(site);
        } catch (ParserConfigurationException e) {
            throw new BuildException("Couldn't initialize XML parser", e);
        } catch (IOException e) {
            throw new BuildException("Couldn't find site XML: " + site.toString(), e);
        } catch (SAXException e) {
            throw new BuildException("Couldn't parse site XML: " + site.toString(), e);
        }
        List<Page> pages = new ArrayList<>();
        NodeList elems = siteDoc.getElementsByTagName("page");
        for (int i = 0; i < elems.getLength(); i++) {
            Element elem = (Element) elems.item(i);
            String href = elem.getAttribute("href");
            File page = new File("src/" + href);
            Document pageDoc;
            try {
                pageDoc = builder.parse(page);
            } catch (IOException e) {
                throw new BuildException("Couldn't find page XML: " + page.toString(), e);
            } catch (SAXException e) {
                throw new BuildException("Couldn't parse page XML: " + page.toString(), e);
            }
            String dest = pageDoc.getDocumentElement().getAttribute("dest");
            pages.add(new Page(href, dest));
        }
        return pages;
    }
}
