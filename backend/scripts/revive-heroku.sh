#! /bin/bash

APP_KEY1=$(openssl rand -base64 32)
APP_KEY2=$(openssl rand -base64 32)

# Environment variables
export APP_KEYS="${APP_KEY1},${APP_KEY2}"
export API_TOKEN_SALT=$(openssl rand -base64 32)
export ADMIN_JWT_SECRET=$(openssl rand -base64 32)
export JWT_SECRET=$(openssl rand -base64 32)
# Database
DATABASE_CLIENT=sqlite
DATABASE_FILENAME=.tmp/data.db

npx strapi import --force -f exports/profekto.tar.gz
