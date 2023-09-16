const fs = require('fs');
const yaml = require('js-yaml');

class AppleConfig {
  constructor(apiKeyPath, apiKeyId, issuerId, appId) {
    this.apiKeyPath = apiKeyPath;
    this.apiKeyId = apiKeyId;
    this.issuerId = issuerId;
    this.appId = appId;
  }
}

try {
  // Load YAML file
  const yamlData = fs.readFileSync('./config/apple.yml', 'utf8');
  // Parse YAML data into a JavaScript object
  const config = yaml.load(yamlData);

  const appleConfig = new AppleConfig(
    config.api_key_path,
    config.api_key_id,
    config.issuer_id,
    config.app_id);

  module.exports = appleConfig;
} catch (error) {
  console.error('Error reading or parsing YAML file:', error);
  throw new Error('Error reading or parsing YAML file');
}