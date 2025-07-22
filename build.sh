#! /usr/bin/bash

rm -rf ./generated-blog-site

cd ./blog-src-zola
./zola build

mv ./public ../generated-blog-site
