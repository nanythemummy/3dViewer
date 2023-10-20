package edu.berkeley._3dcoffins;

import java.io.File;

/**
 * Represents a page to be transformed. We only track
 * what we need to know to build the page.
 */
class Page {
    private Config config;
    public String href;
    public String dest;

    /**
     * Construct the Page from a "href" attribute representing
     * its source and a "dest" attribute representing its
     * destination. Both are assumed to be leaf filenames only;
     * the config will supply the directory locations.
     */
    public Page(Config config, String href, String dest) {
        this.config = config;
        this.href = href;
        this.dest = dest;
    }

    /**
     * Returns the source file to be transformed.
     */
    public File getSource() {
        return MorePaths.resolve(config.builddir, href);
    }

    /**
     * Returns the file location the transformed page should
     * be written to.
     */
    public File getDestination() {
        return MorePaths.resolve(config.distdir, dest);
    }
}
