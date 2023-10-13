package edu.berkeley._3dcoffins;

import java.io.File;
import java.nio.file.Paths;

class MorePaths {
    public static File resolve(File dir, String fileName) {
        return Paths.get(dir.toString(), fileName).toFile();
    }
}
