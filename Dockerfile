FROM python:3.8-buster

WORKDIR /home
RUN apt-get update \
    && apt-get install -y xmlstarlet openjdk-11-jre-headless \
    && rm -rf /var/lib/apt/lists/*
COPY requirements.txt /home
RUN pip install -U pip && pip install --no-cache-dir -r requirements.txt

COPY assets /home/assets
COPY src /home/src
COPY static /home/static
COPY tools /home/tools
COPY *.py /home/

RUN python3 build.py -v

FROM nginx:1.17-alpine

WORKDIR /home
COPY --from=0 /home/dist /usr/share/nginx/html
