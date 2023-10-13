package edu.berkeley._3dcoffins;

/**
 * A simple exception representing a problem
 * configuring BuildSite.
 */
public class ConfigException extends Exception {
    public ConfigException(String msg) {
        super(msg);
    }

    public ConfigException(String msg, Throwable cause) {
        super(msg, cause);
    }
}
