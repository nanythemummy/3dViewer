# buildSite

We have a Java tool called `buildSite` that does all the XSLT processing for the site (site2html and
page2html) in one shot, wrapping the Saxon Java tool so that we don't have to run it in many separate
Java invocations.

`buildSite` is checked in at `tools/buildSite-{VERSION}.jar` so you don't generally
need to worry about building this tool when getting started with the project. `build.py` takes care of
invoking it for you.

The tool currently makes many assumptions about where things in the project are located. Should this
change, the tool may need to be updated.

## Building the buildSite tool

The source for the tool is in `tools/java`, and the main class is
`tools/java/edu/berkeley/_3dcoffins/BuildSite.java`.

A Python script called `build_jar.py` can rebuild the JAR on demand. `build_jar.py` deposits the built
JAR in `build/tools/buildSite-{VERSION}.jar`. **Important:** you must copy this JAR file to `tools/`
to test it, and check it in if it works!

`tools/build/jar/config.py` defines the version of the resulting JAR if you need to bump the version.
Be sure to update the version referenced in `tools/build/config.py` (currently, it's
the default value for the `--buildsitejarpath` option), so that `build.py` knows to look for
the new version!
