# Building the 3D Viewer with Docker

We now support an alternate method of building and running the 3D Viewer: via Docker containers.

Pros:
   * The only dependency you need on your local MacOS system is the Docker Desktop. All other build
     dependencies are managed inside Docker containers and installed automatically for you.
   * The final product is a Docker image that will run on any system that has Docker installed –
     whether Windows, MacOS, or Linux.

Cons:
   * You need to know a few Docker commands to run the built container and manage it. More
     generally, Docker is a sophisticated development and deployment tool with an ecosystem of
     commands all its own.
   * The Docker approach is not so great for certain kinds of local development. Nominally, you
     need to rebuild the container every time you want to make a change to the source. In practice,
     there are ways of making at least the CSS/JS assets editable from outside the container, but
     it's a bit tricky to set up.

## Requirements

We assume you're using MacOS, in which case your Terminal runs the `bash` shell needed to
execute the `build-docker` script.

You need [Docker Desktop](https://hub.docker.com/?overlay=onboarding) installed on your computer.
Once it's installed, launch it to boot up a Docker server that will stay running on your system.
This will also install the `docker` command-line tool for you the first time that it's run.

During the installation and initial startup, you  will also be guided to create a Docker Hub
account, so that you can publish Docker images that you create. Perhaps down the road we'll do
this.

## Using

From a terminal at the top level of your directory, run the following: `./build-docker.sh`. Docker
will take over and build your final container.

   * If there are errors, simply fix them and rebuild. Rebuilds should be significantly faster, as
     most of the installation work in the build container is cached by Docker.
   * If something cached by Docker is causing persistent errors, you can use
     `./build-docker.sh --no-cache` to force a rebuild from scratch.

Once the build process runs to completion, run `docker images`. You should see an image tagged
`botd3d-viewer:latest`, ready to run.

To run the container: `docker run -d -p 8080:80 --name 3dViewer botd3d-viewer:latest`. Then point
your browser to [http://localhost:8080/](http://localhost:8080).

Some useful Docker commands:

   * To see what's running: `docker ps`. You should see a container called '3dViewer' running off of
     the image 'botd3d-viewer:latest', and for ports you should see something like
     `0.0.0.0:8080->80/tcp` showing that the web server is listening on the host's port 8080.
   * To launch a shell inside the running container for debugging:
     `docker exec -it 3dViewer /bin/sh`. The web distribution is installed at
     `/usr/share/nginx/html`, and the web server configuration is at
     `/etc/nginx/nginx.conf`.
   * To stop and delete the container: `docker stop 3dviewer` followed by `docker rm 3dviewer`.
     The image will still be available, though.
   * To extract the web distribution from the running container:
     `docker cp 3dViewer:/usr/share/nginx/html ./dist`. Then look inside the `dist/` subdirectory
     for the files.
