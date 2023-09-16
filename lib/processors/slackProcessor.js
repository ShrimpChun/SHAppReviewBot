const Processor = require('../models/processor');
const Payload = require('../models/payload');
const Attachment = require('../models/attachment');

const { DateTime } = require('luxon');
const fs = require('fs');
const https = require('https');
const yaml = require('js-yaml');

class SlackProcessor extends Processor {
  constructor(platform) {
    super(platform);
    this.platform = platform;
    const config = this.loadYAML(this.platform);

    let matchedProcessor = null;

    for (const processor of config.processors || []) {
      if (processor.class === 'SlackProcessor') {
        matchedProcessor = processor;
        break;
      }
    }

    if (matchedProcessor === null) { throw new Error('Failed to get SlackProcessor.'); }

    this.botToken = matchedProcessor.slackBotToken;
    this.inCommingWebHookURL = matchedProcessor.slackInCommingWebHookURL;
    this.targetChannel = matchedProcessor.slackBotTargetChannel;
    this.timeZoneOffset = this.unwrapRequiredParameter(matchedProcessor, 'slackTimeZoneOffset');
    this.attachmentGroupByNumber = 1;

    if (
      matchedProcessor.slackAttachmentGroupByNumber &&
      matchedProcessor.slackAttachmentGroupByNumber !== '' &&
      parseInt(matchedProcessor.slackAttachmentGroupByNumber) > 0 &&
      parseInt(matchedProcessor.slackAttachmentGroupByNumber) < 100
      ) {
      this.attachmentGroupByNumber = parseInt(matchedProcessor.slackAttachmentGroupByNumber);
    }

    if ((!this.botToken && !this.inCommingWebHookURL) || (this.botToken === '' && this.inCommingWebHookURL === '')) {
      throw new Error ('Must specify slackBotToken or slackInCommingWebHookURL in SlackProcessor.');
    } else if (this.botToken && this.botToken !== '' && (!this.targetChannel || this.targetChannel === '')) {
      throw new Error('Must specify slackBotTargetChannel in SlackProcessor.');
    }

    console.log('[SlackProcessor] Init Success.');
  }

  loadYAML(platform) {
    try {
      // Load YAML file
      const yamlData = fs.readFileSync(`./config/${platform}.yml`, 'utf8');
      // Parse YAML data into a JavaScript object
      return yaml.load(yamlData);
    } catch (error) {
      throw new Error('Error reading or parsing YAML file');
    }
  }

  unwrapRequiredParameter(processor, parameterName) {
    const parameterValue = processor[parameterName];
    if (parameterValue === undefined || parameterValue === null || parameterValue === '') {
      throw new Error(`Required parameter '${parameterName} is missing or empty.'`);
    }
    return parameterValue;
  }  

  async sendWelcomeMessage(platform) {
    const payload = new Payload();
    payload.attachments = []

    const attachment = new Attachment(
      'good',
      'SHAppReviewBot Standing By :rocket:',
      'SHAppReviewBot Standing By :rocket:',
      `${platform} Init Success!, will resend App Review to this channel automatically.`,
      'ShrimpHsieh',
      'Powered by <https://www.shrimpstudio.app|Shrimp Hsieh>',
    );

    payload.attachments.push(attachment);

    this.postMessage(payload)
        .then(async (response) => {
          if (!response.ok) {
            console.error(`${response.message}`);
          }
        })
        .catch((error) => {
          console.error(`Error making Slack API request: ${error.message}`);
        });
  }

  async processReviews(reviews, platform) {
    if (reviews.length < 1) {
      return reviews;
    }

    const pendingPayloads = [];
    // Slack Message Limitation: posting one message per second per channel
    const attachmentGroupByNumber = 1;

    for (let i = 0; i < reviews.length; i += attachmentGroupByNumber) {
      const reviewGroup = reviews.slice(i, i + attachmentGroupByNumber);
      const payload = new Payload();

      for (const review of reviewGroup) {
        const stars = '★'.repeat(review.rating) + '☆'.repeat(5 - review.rating);
        const color = review.rating >= 4 ? 'good' : review.rating > 2 ? 'warning' : 'danger';

        const offset = this.parseTimeZoneOffset(this.timeZoneOffset);
        const date = this.formatDateTime(review.timestamp, offset);

        const title = review.title ? `${review.title} - ${stars}` : stars;
        const attachment = new Attachment(
          color,
          title,
          title,
          review.body,
          review.userName,
          `${platform} - ${review.platform} - ${review.appVersion} - ${review.territory} - <${review.url}|${date}>`,
        );

        payload.attachments.push(attachment);
      }

      pendingPayloads.push(payload);
    }

    while (pendingPayloads.length > 0) {
      const payload = pendingPayloads.shift();
      this.postMessage(payload)
        .then(async (response) => {
          if (!response.ok) {
            await this.sleep(1000);
            console.log('[SlackProcessor] Reached Rate Limited, sleep 1 sec...');
          }
        })
        .catch((error) => {
          console.error(`Error making Slack API request: ${error.message}`);
        });
        break;
    }

    return reviews;
  }


  // API Document: https://api.slack.com/methods/chat.postMessage
  async postMessage(payload) {
    let isUsingSlackBotToken = this.botToken !== '';
    // Send data using methods provided by the Slack API.
    const apiUrl = new URL(isUsingSlackBotToken ? 'https://slack.com/api/chat.postMessage' : this.inCommingWebHookURL);
    payload.channel = isUsingSlackBotToken ? this.targetChannel : null;
    const postData = JSON.stringify(payload.toJSON());

    const headers = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData),
    };

    if (isUsingSlackBotToken) {
      headers.Authorization = `Bearer ${this.botToken}`;
    }

    const options = {
      hostname: apiUrl.hostname,
      port: 443,
      path: apiUrl.pathname,
      method: 'POST',
      headers,
    };

    return new Promise((resolve, reject) => {
      const request = https.request(options, (res) => {
        let responseData = '';
        
        res.on('data', (chunk) => {
          responseData += chunk;
        });

        res.on('end', () => {
          if (isUsingSlackBotToken) {
            try {
              const responseJson = JSON.parse(responseData);
              resolve({ ok: responseJson.ok === true, message: responseJson.error });
            } catch (error) {
              reject(new Error(`Error parsing Slack API response: ${error.message}`));
            }
          } else {
            // Using InCommingWebHook
            resolve({ ok: responseJson === 'ok', message: null });
          }
        });
      });

      request.on('error', (error) => {
        reject(new Error(`Error making Slack API request: ${error}, ${error.message}`));
      });

      request.write(postData);
      request.end();
    });
    
  }
  
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  parseTimeZoneOffset(offsetString) {
    const parts = offsetString.match(/([+-])(\d{2}):(\d{2})/);

    if (!parts) {
      throw new Error('Invalid time zone offset format');
    }

    // Parse hours and minutes
    const sign = parts[1] === '+' ? 1 : -1;
    const hours = parseInt(parts[2], 10);
    const minutes = parseInt(parts[3], 10);

    // Convert to minutes
    return sign * (hours * 60 + minutes);
  }

  formatDateTime(timestamp, timeZoneOffset) {
    const date = new Date(timestamp * 1000);

    const offsetMillis = timeZoneOffset * 60 * 1000;
    const adjustedDate = new Date(date.getTime() + offsetMillis);

    const options = {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZoneName: 'short'
    };
    const formatter = new Intl.DateTimeFormat('en-US', options);
    const parts = formatter.formatToParts(adjustedDate);

    const year = parts.find(part => part.type === 'year').value;
    const month = parts.find(part => part.type === 'month').value;
    const day = parts.find(part => part.type === 'day').value;
    const hour = parts.find(part => part.type === 'hour').value;
    const minute = parts.find(part => part.type === 'minute').value;
    const second = parts.find(part => part.type === 'second').value;
    const formattedDateTime = `${year}-${month}-${day} ${hour}:${minute}:${second}`;
    return formattedDateTime;
  }
}

module.exports = SlackProcessor;