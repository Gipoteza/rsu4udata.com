#!/bin/sh
# Railway передаёт порт через $PORT, подставляем в nginx конфиг
PORT=${PORT:-8080}
sed -i "s/listen 80;/listen ${PORT};/g" /etc/nginx/conf.d/default.conf
exec nginx -g 'daemon off;'
