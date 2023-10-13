package edu.berkeley._3dcoffins;

import java.io.File;
import java.nio.file.Paths;

/**
 * A little extension to java.nio.file.Paths.
 * It's a rough equivalent to os.path.join in Python.
 */
class MorePaths {
    /**
     * Given a directory and a leaf path, return the File
     * corresponding to their joining. It's roughly equivalent
     * to os.path.join in Python.
     */
    public static File resolve(File dir, String fileName) {
        return Paths.get(dir.toString(), fileName).toFile();
    }
}
