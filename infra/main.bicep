// =============================================================================
// Onera Operator — Azure Infrastructure
// =============================================================================
// Frontend : Azure Web App (Linux, Docker) — Next.js standalone
// Backend  : Azure Web App (Linux, Docker) — Fastify
// Plan     : Existing ASP-onera (P1v3) in onera resource group
// ACR      : Existing oneraacr.azurecr.io
// Database : Neon PostgreSQL (external)
// Redis    : Azure Cache for Redis — onera-redis (existing, onera RG)
// =============================================================================

targetScope = 'resourceGroup'

// -----------------------------------------------------------------------------
// Parameters
// -----------------------------------------------------------------------------

@description('Azure region')
param location string = resourceGroup().location

@description('Name of the existing App Service Plan')
param appServicePlanName string = 'ASP-onera'

@description('ACR login server')
param acrLoginServer string = 'oneraacr.azurecr.io'

@secure()
@description('ACR admin username')
param acrUsername string

@secure()
@description('ACR admin password')
param acrPassword string

@description('Backend Docker image (without tag)')
param backendImage string = 'onera-operator-backend'

@description('Frontend Docker image (without tag)')
param frontendImage string = 'onera-operator-frontend'

@description('Image tag')
param imageTag string = 'latest'

// --- Secrets ---
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

param frontendCustomDomain string = 'operator.onera.chat'
param backendCustomDomain string = 'operator-api.onera.chat'

// -----------------------------------------------------------------------------
// Variables
// -----------------------------------------------------------------------------

var tags = { app: 'onera-operator', managedBy: 'bicep' }
var frontendUrl = 'https://${frontendCustomDomain}'
var backendUrl  = 'https://${backendCustomDomain}'

// -----------------------------------------------------------------------------
// Reference existing App Service Plan
// -----------------------------------------------------------------------------

resource plan 'Microsoft.Web/serverfarms@2023-01-01' existing = {
  name: appServicePlanName
}

// -----------------------------------------------------------------------------
// Backend — Fastify (Docker)
// -----------------------------------------------------------------------------

resource backend 'Microsoft.Web/sites@2023-01-01' = {
  name: 'onera-operator-backend'
  location: location
  tags: tags
  kind: 'app,linux,container'
  properties: {
    serverFarmId: plan.id
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: 'DOCKER|${acrLoginServer}/${backendImage}:${imageTag}'
      alwaysOn: true
      ftpsState: 'Disabled'
      http20Enabled: true
      minTlsVersion: '1.2'
      healthCheckPath: '/api/health'
      cors: {
        allowedOrigins: [
          frontendUrl
          'https://onera-operator-frontend.azurewebsites.net'
        ]
        supportCredentials: true
      }
      appSettings: [
        { name: 'DOCKER_REGISTRY_SERVER_URL',       value: 'https://${acrLoginServer}' }
        { name: 'DOCKER_REGISTRY_SERVER_USERNAME',   value: acrUsername }
        { name: 'DOCKER_REGISTRY_SERVER_PASSWORD',   value: acrPassword }
        { name: 'WEBSITES_ENABLE_APP_SERVICE_STORAGE', value: 'false' }
        { name: 'WEBSITES_PORT',                     value: '3001' }
        { name: 'NODE_ENV',                          value: 'production' }
        { name: 'PORT',                              value: '3001' }
        { name: 'BACKEND_PORT',                      value: '3001' }
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
// Frontend — Next.js standalone (Docker)
// -----------------------------------------------------------------------------

resource frontend 'Microsoft.Web/sites@2023-01-01' = {
  name: 'onera-operator-frontend'
  location: location
  tags: tags
  kind: 'app,linux,container'
  properties: {
    serverFarmId: plan.id
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: 'DOCKER|${acrLoginServer}/${frontendImage}:${imageTag}'
      alwaysOn: true
      ftpsState: 'Disabled'
      http20Enabled: true
      minTlsVersion: '1.2'
      appSettings: [
        { name: 'DOCKER_REGISTRY_SERVER_URL',       value: 'https://${acrLoginServer}' }
        { name: 'DOCKER_REGISTRY_SERVER_USERNAME',   value: acrUsername }
        { name: 'DOCKER_REGISTRY_SERVER_PASSWORD',   value: acrPassword }
        { name: 'WEBSITES_ENABLE_APP_SERVICE_STORAGE', value: 'false' }
        { name: 'WEBSITES_PORT',                     value: '3000' }
        { name: 'NODE_ENV',                          value: 'production' }
        { name: 'PORT',                              value: '3000' }
        { name: 'NEXT_TELEMETRY_DISABLED',           value: '1' }
        { name: 'NEXT_PUBLIC_BACKEND_URL',           value: backendUrl }
        { name: 'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', value: clerkPublishableKey }
        { name: 'CLERK_SECRET_KEY',                  value: clerkSecretKey }
        { name: 'NEXT_PUBLIC_CLERK_SIGN_IN_URL',     value: clerkSignInUrl }
        { name: 'NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL', value: clerkAfterSignInUrl }
        { name: 'NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL', value: clerkAfterSignUpUrl }
        { name: 'NEXT_PUBLIC_CLERK_AFTER_SIGN_OUT_URL', value: clerkAfterSignOutUrl }
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
