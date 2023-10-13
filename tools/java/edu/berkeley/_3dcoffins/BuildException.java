package edu.berkeley._3dcoffins;

/**
 * A simple exception representing a generic error
 * while running BuildSite.
 */
public class BuildException extends Exception {
    public BuildException(String msg) {
        super(msg);
    }

    public BuildException(String msg, Throwable cause) {
        super(msg, cause);
    }
}
