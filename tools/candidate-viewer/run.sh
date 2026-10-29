#!/bin/bash
# usage: run.sh '<jobs-json>'  (starts a static server for the duration of the run)
cd "$(dirname "$0")"
python3 -m http.server 8765 >/tmp/http.log 2>&1 &
SP=$!
sleep 1.2
python3 shoot.py "$1"
kill $SP 2>/dev/null
