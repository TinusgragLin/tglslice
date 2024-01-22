#! /usr/bin/bash

time=$((60 * 60 * 5))

whereami=$(dirname $(realpath "$0"))
log_file="$whereami/regular-update.log"

echo "Update every $time seconds."

while true
do
    date >> $log_file
    git pull 1>>$log_file 2>&1
    sleep $time
done
