package edu.berkeley._3dcoffins;

public class BuildException extends Exception {
    public BuildException(String msg) {
        super(msg);
    }

    public BuildException(String msg, Throwable cause) {
        super(msg, cause);
    }
}
