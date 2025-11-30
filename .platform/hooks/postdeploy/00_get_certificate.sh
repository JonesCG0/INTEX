#!/usr/bin/env bash
# .platform/hooks/postdeploy/00_get_certificate.sh
sudo certbot -n -d http://suitsontheloose.is404.net/ --nginx --agree-tos --email jonescg0@byu.edu