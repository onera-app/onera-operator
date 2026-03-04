// =============================================================================
// Onera Operator — Azure Infrastructure
// =============================================================================
// Frontend : Azure Web App (Linux, Node 20, B1) — Next.js standalone
// Backend  : Azure Web App (Linux, Node 20, B1) — Fastify
// Both share one App Service Plan (B1 = ~$13/mo total)
// Database : Neon PostgreSQL (external)
// Redis    : Azure Cache for Redis — onera-redis (existing, onera RG)
// =============================================================================

targetScope = 'resourceGroup'

// -----------------------------------------------------------------------------
// Parameters
// -----------------------------------------------------------------------------

@description('Base name for all resources')
param appName string = 'onera'

@description('Azure region')
param location string = resourceGroup().location

@description('Environment (dev | staging | prod)')
@allowed(['dev', 'staging', 'prod'])
param environment string = 'prod'

@secure()
param databaseUrl string

@secure()
param redisUrl string

@secure()
param aiApiKey string

param aiProvider string = 'azure'
param aiModel string = 'gpt-4o'
param aiBaseUrl string = ''
param aiAzureResourceName string = ''
param aiAzureDeploymentName string = ''

@secure()
param exaApiKey string = ''

@secure()
param clerkPublishableKey string

@secure()
param clerkSecretKey string

param clerkSignInUrl string = '/login'
param clerkAfterSignInUrl string = '/dashboard'
param clerkAfterSignUpUrl string = '/new'
param clerkAfterSignOutUrl string = '/home'

param frontendCustomDomain string = 'orchestrator.onera.chat'
param backendCustomDomain string = 'orchestrator-api.onera.chat'

// -----------------------------------------------------------------------------
// Variables
// -----------------------------------------------------------------------------

var prefix = '${appName}-${environment}'
var tags = { app: appName, environment: environment, managedBy: 'bicep' }
var frontendUrl = 'https://${frontendCustomDomain}'
var backendUrl  = 'https://${backendCustomDomain}'

// -----------------------------------------------------------------------------
// App Service Plan — Linux B1, shared by both apps (no extra cost)
// -----------------------------------------------------------------------------

resource plan 'Microsoft.Web/serverfarms@2023-01-01' = {
  name: '${prefix}-plan'
  location: location
  tags: tags
  kind: 'linux'
  sku: {
    name: 'B1'
    tier: 'Basic'
  }
  properties: {
    reserved: true
  }
}

// -----------------------------------------------------------------------------
// Backend — Fastify (Node 20)
// Startup: node packages/backend/dist/index.js
// -----------------------------------------------------------------------------

resource backend 'Microsoft.Web/sites@2023-01-01' = {
  name: '${prefix}-backend'
  location: location
  tags: tags
  kind: 'app,linux'
  properties: {
    serverFarmId: plan.id
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: 'NODE|20-lts'
      alwaysOn: true
      ftpsState: 'Disabled'
      http20Enabled: true
      minTlsVersion: '1.2'
      appCommandLine: 'node packages/backend/dist/index.js'
      healthCheckPath: '/api/health'
      cors: {
        allowedOrigins: [frontendUrl, 'https://${prefix}-frontend.azurewebsites.net']
        supportCredentials: true
      }
      appSettings: [
        { name: 'NODE_ENV',                          value: 'production' }
        { name: 'WEBSITE_NODE_DEFAULT_VERSION',      value: '~20' }
        { name: 'SCM_DO_BUILD_DURING_DEPLOYMENT',    value: 'false' }
        { name: 'WEBSITE_RUN_FROM_PACKAGE',          value: '1' }
        { name: 'PORT',                              value: '8080' }
        { name: 'BACKEND_PORT',                      value: '8080' }
        { name: 'DATABASE_URL',                      value: databaseUrl }
        { name: 'REDIS_URL',                         value: redisUrl }
        { name: 'AI_PROVIDER',                       value: aiProvider }
        { name: 'AI_MODEL',                          value: aiModel }
        { name: 'AI_API_KEY',                        value: aiApiKey }
        { name: 'AI_BASE_URL',                       value: aiBaseUrl }
        { name: 'AI_AZURE_RESOURCE_NAME',            value: aiAzureResourceName }
        { name: 'AI_AZURE_DEPLOYMENT_NAME',          value: aiAzureDeploymentName }
        { name: 'EXA_API_KEY',                       value: exaApiKey }
        { name: 'FRONTEND_URL',                      value: frontendUrl }
        { name: 'CLERK_SECRET_KEY',                  value: clerkSecretKey }
        { name: 'AGENT_LOOP_INTERVAL_CRON',          value: '0 */4 * * *' }
        { name: 'DAILY_REPORT_CRON',                 value: '0 18 * * *' }
        { name: 'WEBSITE_HEALTHCHECK_MAXPINGFAILURES', value: '3' }
      ]
    }
  }
}

// -----------------------------------------------------------------------------
// Frontend — Next.js standalone (Node 20)
// Startup: node packages/frontend/server.js
// -----------------------------------------------------------------------------

resource frontend 'Microsoft.Web/sites@2023-01-01' = {
  name: '${prefix}-frontend'
  location: location
  tags: tags
  kind: 'app,linux'
  properties: {
    serverFarmId: plan.id
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: 'NODE|20-lts'
      alwaysOn: true
      ftpsState: 'Disabled'
      http20Enabled: true
      minTlsVersion: '1.2'
      appCommandLine: 'node packages/frontend/server.js'
      appSettings: [
        { name: 'NODE_ENV',                              value: 'production' }
        { name: 'WEBSITE_NODE_DEFAULT_VERSION',          value: '~20' }
        { name: 'SCM_DO_BUILD_DURING_DEPLOYMENT',        value: 'false' }
        { name: 'WEBSITE_RUN_FROM_PACKAGE',              value: '1' }
        { name: 'PORT',                                  value: '8080' }
        { name: 'NEXT_TELEMETRY_DISABLED',               value: '1' }
        { name: 'NEXT_PUBLIC_BACKEND_URL',               value: backendUrl }
        { name: 'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',     value: clerkPublishableKey }
        { name: 'CLERK_SECRET_KEY',                      value: clerkSecretKey }
        { name: 'NEXT_PUBLIC_CLERK_SIGN_IN_URL',         value: clerkSignInUrl }
        { name: 'NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL',   value: clerkAfterSignInUrl }
        { name: 'NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL',   value: clerkAfterSignUpUrl }
        { name: 'NEXT_PUBLIC_CLERK_AFTER_SIGN_OUT_URL',  value: clerkAfterSignOutUrl }
      ]
    }
  }
}

// -----------------------------------------------------------------------------
// Outputs
// -----------------------------------------------------------------------------

output backendAppName    string = backend.name
output backendDefaultUrl string = 'https://${backend.properties.defaultHostName}'
output frontendAppName   string = frontend.name
output frontendDefaultUrl string = 'https://${frontend.properties.defaultHostName}'
output planName          string = plan.name
