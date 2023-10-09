import os.path
from typing import List


class Config:
    def __init__(self):
        self.version = "0.0.1-SNAPSHOT"
        self.build_dir = "build"
        self.build_tools_dir: str = os.path.join(self.build_dir, "tools")
        self.build_java_dir: str = os.path.join(self.build_tools_dir, "java")
        self.tools_dir = "tools"
        self.tools_java_dir: str = os.path.join(self.tools_dir, "java")
        self.manifest_path: str = os.path.join("META-INF", "MANIFEST.MF")
        self.manifest_src: str = os.path.join(self.tools_java_dir, self.manifest_path)
        self.saxon_jar_filename = "saxon-he-12.3.jar"
        self.saxon_src: str = os.path.join(self.tools_dir, self.saxon_jar_filename)
        self.saxon_dest: str = os.path.join(self.build_tools_dir, self.saxon_jar_filename)
        self.saxon_lib_src_dir: str = os.path.join(self.tools_dir, "lib")
        self.saxon_lib_dest_dir: str = os.path.join(self.build_tools_dir, "lib")
        self.package_path: str = os.path.join("edu", "berkeley", "_3dcoffins")
        self.package_src_dir: str = os.path.join(self.tools_java_dir, self.package_path)
        self.javac_classpath: List[str] = [self.tools_java_dir, self.saxon_src]
        self.out_jar_filename: str = os.path.join(self.build_tools_dir, f"buildSite-{self.version}.jar")
