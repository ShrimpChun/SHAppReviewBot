const PlatformManager = require('./lib/models/platformManager');
const AppleFetcher = require('./lib/appleFetcher');

// Build Apple PlatformManager
const platformManager = new PlatformManager('apple');
const appleFetcher = new AppleFetcher(platformManager);
appleFetcher.execute();