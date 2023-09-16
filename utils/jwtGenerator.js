const fs = require('fs');
const jwt = require('jsonwebtoken');

// Import Classes
const AppleConfig = require('../lib/models/appleConfig');
 
try {
	// Access parameters
	const privateKey = fs.readFileSync(AppleConfig.apiKeyPath, 'utf8');

	// Reference: https://developer.apple.com/documentation/appstoreconnectapi/generating_tokens_for_api_requests
	/*
		alg - Encryption Algorithm. All JWTs for App Store Connect API must be signed with ES256 encryption.
		kid - Key Identifier. Your private key ID from App Store Connect
		typ - Token Type. Default JWT.
	*/
	const header = {
		alg: 'ES256',
		kid: AppleConfig.apiKeyId,
		typ: 'JWT'
	}

	/*
		iss - Issuer ID. Your issuer ID from the API Keys page in App Store Connect; for example, 57246542-96fe-1a63-e053-0824d011072a.
		iat - Issued At Time. The token’s creation time, in UNIX epoch time; for example, 1528407600.
		exp - Expiration Time. The token’s expiration time in Unix epoch time.
		aud - Audience. Default appstoreconnect-v1.
		scope - Token Scope.  list of operations you want App Store Connect to allow for this token; for example, GET /v1/apps/123. (Optional)
	*/
	const payload = {
		iss: AppleConfig.issuerId,
		iat: Math.floor(Date.now() / 1000),
		exp: Math.floor(Date.now() / 1000) + 60 * 20,
		aud: 'appstoreconnect-v1'
	}

	// Generate JWT Token
	const jwtToken = jwt.sign(payload, privateKey, { algorithm: 'ES256', header });
	module.exports = { jwtToken };
	
} catch (error) {
	console.error('Error reading or parsing YAML file:', error);
	throw new Error('Error reading or parsing YAML file');
}