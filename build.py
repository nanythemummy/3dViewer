#!/usr/bin/env python3
import argparse
import os
import shutil
import sys


def copySrc(config):
    srcdir = 'src'
    for dirpath, _, filenames in os.walk(srcdir):
        for f in filenames:
            if f.endswith('.js'):
                shutil.copy(os.path.join(dirpath, f), os.path.join(config.distdir, 'js', f))
            else:
                shutil.copy(os.path.join(dirpath, f), os.path.join(config.distdir, f))


def copyAssets(config):
    print('Copying static assets')
    staticdir = 'static'
    for item in os.listdir(staticdir):
        src = os.path.join(staticdir, item)
        dest = os.path.join(config.distdir, item)
        if os.path.isdir(src):
            shutil.copytree(src, dest)
        else:
            shutil.copy(src, dest)

    print('Copying models')
    modelsdestdir = os.path.join(config.distdir, 'models')
    os.makedirs(modelsdestdir)
    for dirpath, _, filenames in os.walk(config.assetsdir):
        for f in filenames:
            if f.endswith('.gltf'):
                shutil.copy(os.path.join(dirpath, f), os.path.join(modelsdestdir, f))


def buildSite(config):
    copyAssets(config)
    copySrc(config)


def getConfig(args):
    parser = argparse.ArgumentParser()
    parser.add_argument('--assetsdir', help='where model assets are stored', default='../assets')
    parser.add_argument('--distdir', help='where build output is written', default='dist')
    config = parser.parse_args(args[1:])
    if config.distdir == '/':
        parser.error('Cannot set dist directory to root!')
    return config


def prepareDistDir(config):
    if not os.path.exists(config.distdir):
        print('Creating dist directory: {}'.format(config.distdir))
        os.makedirs(config.distdir)
        return

    print('Cleaning dist directory: {}'.format(config.distdir))
    # Don't just use shutil.rmtree on config.distdir and recreate it --
    # development servers like Python's SimpleHTTPServer will not switch to the
    # new directory. Instead, just clear out its contents.
    for root, dirs, files in os.walk(config.distdir):
        for f in files:
            os.unlink(os.path.join(root, f))
        for d in dirs:
            shutil.rmtree(os.path.join(root, d))


def main(args):
    os.chdir(os.path.dirname(args[0]))
    config = getConfig(args)
    prepareDistDir(config)
    buildSite(config)


if __name__ == '__main__':
    rv = main(sys.argv)
    sys.exit(rv)