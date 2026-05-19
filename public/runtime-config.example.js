window.__env = Object.assign({
  "KEYCLOAK_URL": "<your-keycloak-url>",
  "KEYCLOAK_REALM": "<your-realm>",
  "KEYCLOAK_ADMIN_CLIENT_ID": "<your-client-id>",
  "KEYCLOAK_GOOGLE_IDP_HINT": "<your-google-idp-hint>",
  "APP_WEBSITE_URL": "<your-app-url>",
  "KEYCLOAK_REFRESH_WINDOW_SECONDS": "300",
  "KEYCLOAK_PROACTIVE_REFRESH_MIN_VALIDITY_SECONDS": "60",
  "KEYCLOAK_REFRESH_CHECK_INTERVAL_MS": "60000"
}, window.__env ?? {});
