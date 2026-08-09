#!/bin/bash
set -e
cd "$(dirname "$0")"
echo "LA MAGDALENA OS 36 · Preparando iPhone, iPad y Mac..."
npm install
npm run apple:create
