#! /usr/bin/bash

cd ./blog-src-zola
./zola build

mv ./public ../generated-blog-site
