#!/bin/sh
set -eu

cat > /usr/share/nginx/html/config.js <<EOF
window.appConfig = {
  apiUrl: "${NG_APP_API_URL:-http://localhost:3000}",
  firebase: {
    apiKey: "${NG_APP_FIREBASE_API_KEY:-}",
    authDomain: "${NG_APP_FIREBASE_AUTH_DOMAIN:-}",
    projectId: "${NG_APP_FIREBASE_PROJECT_ID:-}",
    appId: "${NG_APP_FIREBASE_APP_ID:-}"
  }
};
EOF

