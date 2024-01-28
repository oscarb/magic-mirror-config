#!/bin/sh

DIR="$(dirname "$(readlink -f "$0")")"
YEAR=$(date +'%Y')

curl -s "https://sholiday.faboul.se/dagar/v2.1/$YEAR" | jq '.' > "$DIR/swedish_days.json"