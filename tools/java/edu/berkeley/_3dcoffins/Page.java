package edu.berkeley._3dcoffins;

import java.io.File;

class Page {
    private Config config;
    public String href;
    public String dest;

    public Page(Config config, String href, String dest) {
        this.config = config;
        this.href = href;
        this.dest = dest;
    }

    public File getSource() {
        return MorePaths.resolve(config.builddir, href);
    }

    public File getDestination() {
        return MorePaths.resolve(config.distdir, dest);
    }
}
