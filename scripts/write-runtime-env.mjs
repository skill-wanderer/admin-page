import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const projectRoot = resolve(process.cwd());
const envFilePath = resolve(projectRoot, '.env');
const outputFilePath = resolve(projectRoot, 'public/runtime-config.js');

const defaults = {};

function stripQuotes(value) {
  if (!value) {
    return '';
  }

  const trimmedValue = value.trim();
  if (
    (trimmedValue.startsWith('"') && trimmedValue.endsWith('"')) ||
    (trimmedValue.startsWith("'") && trimmedValue.endsWith("'"))
  ) {
    return trimmedValue.slice(1, -1);
  }

  return trimmedValue;
}

function parseEnvFile(content) {
  return content.split(/\r?\n/).reduce((accumulator, line) => {
    const trimmedLine = line.trim();
    if (!trimmedLine || trimmedLine.startsWith('#')) {
      return accumulator;
    }

    const separatorIndex = trimmedLine.indexOf('=');
    if (separatorIndex === -1) {
      return accumulator;
    }

    const key = trimmedLine.slice(0, separatorIndex).trim();
    const value = trimmedLine.slice(separatorIndex + 1);
    accumulator[key] = stripQuotes(value);
    return accumulator;
  }, {});
}

const fileEnv = existsSync(envFilePath) ? parseEnvFile(readFileSync(envFilePath, 'utf8')) : {};

function resolveRequiredEnv(key) {
  const value = process.env[key] ?? fileEnv[key] ?? defaults[key];
  const normalizedValue = stripQuotes(value);
  if (!normalizedValue) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return normalizedValue;
}

const runtimeEnv = {
  KEYCLOAK_URL: resolveRequiredEnv('KEYCLOAK_URL'),
  KEYCLOAK_REALM: resolveRequiredEnv('KEYCLOAK_REALM'),
  KEYCLOAK_ADMIN_CLIENT_ID: resolveRequiredEnv('KEYCLOAK_ADMIN_CLIENT_ID'),
  KEYCLOAK_GOOGLE_IDP_HINT: resolveRequiredEnv('KEYCLOAK_GOOGLE_IDP_HINT'),
  APP_WEBSITE_URL: resolveRequiredEnv('APP_WEBSITE_URL'),
};

mkdirSync(dirname(outputFilePath), { recursive: true });
writeFileSync(
  outputFilePath,
  `window.__env = Object.assign(${JSON.stringify(runtimeEnv, null, 2)}, window.__env ?? {});\n`,
  'utf8',
);

console.log(`Wrote runtime config to ${outputFilePath}`);