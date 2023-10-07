# 3D Coffin Viewer

This project implements a static website for viewing a set of annotated 3D models of Ancient
Egyptian coffins, as part of the Book of the Dead in 3D project.

The 3D models are the results of photogrammetry, but they have had special hitboxes added to
highlight areas of interest. The hitboxes are mapped to annotations that describe the hieroglyphic
text, its transliterated text, and its translations (e.g. into English).

We use XML source files to describe the structure of the site and the model annotations. These are
transformed into the final website, which can be hosted with whichever web server you wish.

## Requirements

This project was developed on MacOS, and should generally support UNIX-compatible systems.
Henceforth, in this document, we'll assume you're using MacOS, and are familiar with the Terminal.

This project uses command-line tools. If you are unfamiliar with the MacOS/Unix command line,
follow a tutorial like [Learn Enough Command Line To Be Dangerous](https://www.learnenough.com/command-line-tutorial/basics)
or the [Introduction to the Command-Line Interface](https://tutorial.djangogirls.org/en/intro_to_command_line/)
that is part of the Django Girls course.

For MacOS, [Homebrew](https://brew.sh), a popular command-line tool installer and manager, is
highly recommended to install most of the requirements below.

You must have:

* The **Python 3** programming language and interpreter. There are two convenient ways to install
  this:
   * Via homebrew: `brew install python3`
   * Via the standard [Python 3 distribution for MacOS](https://www.python.org/downloads/)
* A suitable **Java Development Kit (JDK)**, version 8 or later. Again, two ways to install:
   * Via homebrew: `brew cask install java` (installs OpenJDK)
   * Via the standard [Oracle JDK SE distribution for MacOS](https://www.oracle.com/technetwork/java/javase/downloads/jdk13-downloads-5672538.html).
     Oracle provides a number of professional options for downloads, but the free(est) edition
     (Standard Edition, aka SE) will do.
* **XML Starlet**, a suite of tools for XML validation and hacking. Install via Homebrew:
  `brew install xmlstarlet`.
* The Python Classical Languages Toolkit, which we will install below as part of setup.

## Setup

### Python Libraries

You will need to install at least one Python library, the Classical Languages Toolkit (CLTK), to
build the website. We recommend installing it in a Python "virtualenv" that will keep your project's
Python libraries separate from other projects so that they don't conflict.

There are many ways to set up a virtualenv in Python, but here's how we do it. From the top of this
repo, run the following: `python3 -m venv venv`. This will create a directory `venv/` in your
repo, and inside that directory is a reference to the specific version of Python you used to create
the virtualenv. Libraries you install while the virtualenv is active will also be saved in this
directory. Do not check this directory into source control – it's specific to your system. (We've
configured Git to ignore it.)

You then need to "activate" the virtual environment to use it. To do so, again from the top of this
repo, run the following: `source venv/bin/activate`. Note the `(venv) ` text next to your prompt to
alert you that your virtualenv is active.

When you are done using a virtualenv, either run `deactivate` to stop using it, or close the
terminal. Each time you open up a new terminal, you will need to activate the virtualenv before
you can work with the project.

When a virtualenv is active, running `python` will always run the specific version of Python
referenced by the virtualenv, and all Python packages will be installed inside your `venv/`
directory, local to your project. When the virtualenv is _not_ active, `python` will run your
default system-installed version of Python (probably Python 2!), and you'll only have access to
system-wide installed Python libraries.

Once your virtualenv is active, install the Python library dependencies thus:
`pip install -r requirements.txt`.

### Assets

We manage our 3D models and hieroglyphic source material in a separate repo from this project. You
will have the easiest time if you place the assets repo _inside_ this repo's top-level directory.
You can place it elsewhere if you wish, but in that case you will need to pass the build script an
option to tell it where to find the assets.

There are also a set of static "assets" inside this repo that are specifically for use by this
website – CSS, web fonts, and Javascript. When you build the project, they will be installed along
with any needed assets from the `assets` directory. When you edit CSS or add other static assets, you should save the files in the "static" directory.

When you're ready to build, your setup should look something like this:

```
- <SOME_DIR> 
    - 3dViewer
        - this README
        - assets
          - <coffin_name>/
              - <coffin_name>.gltf
              - texts/
                  - <coffin_name>.gly
                  - text1.svg
                  - text2.svg
                  - etc.
        - etc.
        - src/
            - main.js
            - site.xml
            - <coffin_name>.xml
            - etc.
        - static/
            - etc.
        - venv/
            - etc.
```


## Building the site

From the top of this repo, make sure that your virtualenv is active, and run:

`python build.py`

If all goes well, this will create a `dist/` directory with the resulting HTML files, as well as all
the other files needed to run the website.

To test the website out: `python -m http.server -d dist 8080`. Then point your browser to
[http://localhost:8080/](http://localhost:8080/).

## Adding a model and annotations

To create a new model (e.g. Psamtik), create a file for the page you want to create, e.g.
`src/psamtik.xml`. Then add a reference to this page in `site.xml` to include it in the build.

The new XML file will contain a `page` element with a `model` and `texts` subelement. For the
`model` element, you need to specify:

   * where the `gltf` model is located in the `assets/` repo, and where it should be installed
     in the `dist/` directory.
   * which objects in the GLTF file are "hitboxes", and what text annotations they map to. These
     are done with `link` elements.

The `texts` element contains any number of `text` elements. For the `text` element, you need to
decide whether it's a "simple" text (one fragment of text corresponding to one hitbox) or
a "complex" text spanning multiple text fragments which are spread across several hitboxes. The
`amenirdis` coffin shows an example of a simple text; the `iwefaa` coffin has a mix of complex and
simple texts.

Either way, for each text (or text fragment) you will specify:

   * `id`: a unique identifier for the text fragment, which will be referenced by the model links
     described above.
   * `descr`: a description of the location of the text (`descr`).
   * `himg`: refers to an Scaled Vector Graphics (SVG) image that is the Jsesh rendering of the
     text. You specify where the image lives in the `assets/` repo, and where you want that image
     to be installed in the `dist` directory.
   * `hi`: a copy of the Jsesh code used to produce the hieroglyphs, so that the XML is a complete
     source of truth for the annotations. Doesn't have to be a complete `.gly` file; just the
     line(s) directly used to render the hieroglyphs will suffice.
   * `al`: the Manuel de Codage transliteration of the hieroglyphs. This will be converted to
     Unicode by the build process.
   * `tr`: the translation of the text (e.g. into English).

Use the existing pages as models for how to create these elements. If you want a reference, the
full XML schema for our data is located in the `tools/schema/` directory.
## Preparing the glTF File from an OBJ file

  * For this, please consult the [Building_a_model.md](Building_a_model.md) tutorial in this repo.
  
## Tips

   * You can also run the build script directly instead of as an argument to `python`. To do so:
     `./build.py`. However, it requires that the script have executable permissions. If MacOS
     complains with "Permission denied" when you try to run the build script this way, try telling
     MacOS that it's an executable: `chmod +x build.py`.
   * The build script has a bunch of options if your system is configured differently from ours.
     Use `python build.py --help` to see them.
   * In particular, you can run `python build.py -v` to get a detailed log of what the build tool
     is doing.
   * The schema validation can be quite slow! To bypass it, run `python build.py --no-val`. However,
     be prepared for mysterious errors if your XML coding is incorrect.
   * When in doubt, look at how existing pages are coded, and build up your page bit by bit, so
     that errors can be caught and corrected quickly.
   * For now, we don't support live reload. So, every time you make a change and rerun the build,
     you'll need to reload the browser to see it.

## Docker

We are experimenting with an alternate development setup that uses Docker. If you want to try it
out, you can skip the Requirements and Setup above, and just see [DOCKER.md](DOCKER.md) for details.
