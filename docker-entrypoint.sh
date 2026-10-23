#!/bin/sh
set -eu

mkdir -p /data

if [ "$(id -u)" = "0" ]; then
  chown -R nextjs:nodejs /data
  exec su-exec nextjs:nodejs "$@"
fi

exec "$@"
