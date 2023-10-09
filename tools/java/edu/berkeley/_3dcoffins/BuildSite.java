package edu.berkeley._3dcoffins;

import java.io.File;
import java.util.AbstractMap;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import javax.xml.transform.Source;
import javax.xml.transform.stream.StreamSource;
import net.sf.saxon.s9api.Destination;
import net.sf.saxon.s9api.Processor;
import net.sf.saxon.s9api.QName;
import net.sf.saxon.s9api.SaxonApiException;
import net.sf.saxon.s9api.Serializer;
import net.sf.saxon.s9api.XdmAtomicValue;
import net.sf.saxon.s9api.XdmValue;
import net.sf.saxon.s9api.Xslt30Transformer;
import net.sf.saxon.s9api.XsltCompiler;
import net.sf.saxon.s9api.XsltExecutable;

public class BuildSite {
    private Processor saxon;
    private XsltCompiler compiler;
    private Map<File, Xslt30Transformer> transformers;

    public BuildSite() {
        this.saxon = new Processor(false);
        this.compiler = saxon.newXsltCompiler();
        this.transformers = new HashMap<>();
    }

    public Source makeXmlSource(File path) {
        return new StreamSource(path);
    }

    public Destination makeHtmlSink(File path) {
        Serializer dest = saxon.newSerializer(path);
        dest.setOutputProperty(Serializer.Property.METHOD, "html");
        dest.setOutputProperty(Serializer.Property.INDENT, "yes");
        return dest;
    }

    public Map<String, String> makeParameters() {
        Map<String, String> map = new HashMap<>();
        File buildDir = new File("build");
        File distDir = new File("dist");
        map.put("srcdir", buildDir.getAbsolutePath());
        map.put("destdir", buildDir.getAbsolutePath());
        return map;
    }

    public Xslt30Transformer makeTransformer(File stylesheetPath) throws SaxonApiException {
        Xslt30Transformer transformer = transformers.get(stylesheetPath);
        if (transformer != null) {
            return transformer;
        }

        XsltExecutable stylesheet = compiler.compile(new StreamSource(stylesheetPath));
        transformer = stylesheet.load30();
        Map<String, String> params = makeParameters();
        Map<QName, XdmValue> stylesheetParams = params.entrySet().stream()
            .map(e -> new AbstractMap.SimpleEntry<QName, XdmValue>(
                new QName(e.getKey()), new XdmAtomicValue(e.getValue())
                ))
            .collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue));
        transformer.setStylesheetParameters(stylesheetParams);
        transformers.put(stylesheetPath, transformer);
        return transformer;
    }

    public void transform(File stylesheetPath, File srcPath, File destPath) throws SaxonApiException {
        Source src = makeXmlSource(srcPath);
        Destination dest = makeHtmlSink(destPath);
        Xslt30Transformer transformer = makeTransformer(stylesheetPath);
        System.out.printf("INFO: Transforming (%s): %s -> %s\n", stylesheetPath, srcPath, destPath);
        transformer.transform(src, dest);
    }

    static public void main(String[] args) {
        BuildSite build = new BuildSite();
        Map<String, String> params = build.makeParameters();
        File siteToHtmlPath = new File("tools/xslt/site2html.xsl");
        File site = new File("build/site.xml");
        File index = new File("dist/index.html");
        try {
            build.transform(siteToHtmlPath, site, index);
        } catch (SaxonApiException e) {
            e.printStackTrace();
            System.exit(1);
        }

        try {
            File pageToHtmlPath = new File("tools/xslt/page2html.xsl");
            List<Page> pages = Page.getSitePages(site);
            for (Page page : pages) {
                File src = new File("build/" + page.href);
                File dest = new File("dist/" + page.dest);
                build.transform(pageToHtmlPath, src, dest);
            }
        } catch (BuildException e) {
            e.printStackTrace();
            System.exit(2);
        } catch (SaxonApiException e) {
            e.printStackTrace();
            System.exit(3);
        }
    }
}
