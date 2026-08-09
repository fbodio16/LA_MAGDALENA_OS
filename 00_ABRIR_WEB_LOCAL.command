#!/bin/bash
set -e
cd "$(dirname "$0")"
open "http://localhost:8080"
npm run web:start
