const fs = require('fs');
const path = require('path');

class PlatformManager {
  constructor(platform) {
    this.platform = platform;
  }

  setPlatformLatestCheckTimestamp(timestamp) {
    const basePath = './latest_check_timestamp';
    this.createDirIfNotExist(basePath);

    const filePath = path.join(basePath, this.platform);
    fs.writeFileSync(filePath, timestamp.toString(), 'utf8');
  }

  getPlatformLatestCheckTimestamp() {
    const basePath = './latest_check_timestamp';
    const filePath = path.join(basePath, this.platform);

    if (fs.existsSync(filePath)) {
      const timestamp = fs.readFileSync(filePath, 'utf8');
      return parseInt(timestamp, 10);
    } else {
      return 0;
    }
  }

  setSentWelcomeMessage() {
    const basePath = './latest_check_timestamp';
    this.createDirIfNotExist(basePath);

    const filePath = path.join(basePath, `${this.platform}_welcome`);
    fs.writeFileSync(filePath, '');
  }

  isSentWelcomeMessage() {
    const basePath = './latest_check_timestamp';
    const filePath = path.join(basePath, `${this.platform}_welcome`);
    return fs.existsSync(filePath);
  }

  createDirIfNotExist(dirPath) {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }
}

module.exports = PlatformManager;