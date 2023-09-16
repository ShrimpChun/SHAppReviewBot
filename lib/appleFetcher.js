const { jwtToken } = require('../utils/jwtGenerator');
const fs = require('fs');

// Import Classes
const AppleConfig = require('./models/appleConfig');
const Review = require('./models/review');
const SlackProcessor = require('./processors/slackProcessor');

// Get App ID
const appId = AppleConfig.appId;

class AppleFetcher {
  constructor(platformManager) {
    this.platformManager = platformManager
  }

  async execute() {
    const latestCheckTimestamp = this.platformManager.getPlatformLatestCheckTimestamp();
    console.log(`[AppleFetcher] Start execute(), latestCheckTimestamp: ${latestCheckTimestamp}`);

    let reviews = await this.fetchReviews(latestCheckTimestamp);
    
    if (reviews.length > 0) {
      reviews.sort((a, b) => a.timestamp - b.timestamp);
      console.log(`[AppleFetcher] Latest review: ${reviews[reviews.length - 1].body}, ${reviews[reviews.length - 1].timestamp}`);
      this.platformManager.setPlatformLatestCheckTimestamp(reviews[reviews.length - 1].timestamp);
    }

    const slackProcessor = new SlackProcessor(this.platformManager.platform);
    if (latestCheckTimestamp === 0 && this.platformManager.isSentWelcomeMessage() == false) {
      slackProcessor.sendWelcomeMessage('Apple');
      this.platformManager.setSentWelcomeMessage();
    } else if (reviews.length > 0) {
      reviews = await this.fullFillAppInfo(reviews);
      slackProcessor.processReviews(reviews, 'Apple');
    }
  }

  async fetchReviews(latestCheckTimestamp) {
    // Build CustomerReviews API Request URL
    let customerReviewsURL = `https://api.appstoreconnect.apple.com/v1/apps/${appId}/customerReviews?sort=-createdDate`;
    const reviews = [];

    console.log('[AppleFetcher] Fetching reviews');

    while (customerReviewsURL) {
      const customerReviews = await this.request(customerReviewsURL);
      customerReviewsURL = customerReviews?.links?.next;
      
      console.log(`[AppleFetcher] Fetch reviews, page url: ${customerReviewsURL}`);
      console.log(`[AppleFetcher] Fetch reviews, page's reviews count: ${customerReviews?.data.length}`);

      for (const customerReview of customerReviews?.data || []) {
        const customerReviewID = customerReview?.id;
        const customerReviewReviewerName = customerReview?.attributes?.reviewerNickname;
        const customerReviewRating = parseInt(customerReview?.attributes?.rating, 10);
        const customerReviewTitle = customerReview?.attributes?.title;
        const customerReviewBody = customerReview?.attributes?.body;
        const customerReviewCreatedDate = customerReview?.attributes?.createdDate;
        const customerReviewTerritory = customerReview?.attributes?.territory;

        let customerReviewCreatedDateTimestamp = 0;
        if (customerReviewCreatedDate) {
          customerReviewCreatedDateTimestamp = Math.floor(new Date(customerReviewCreatedDate).getTime() / 1000);
        }

        console.log(`${latestCheckTimestamp}, ${customerReviewCreatedDateTimestamp}`);
        if (latestCheckTimestamp >= customerReviewCreatedDateTimestamp) {
          customerReviewsURL = null;
          break;
        } else {
          const url = `https://appstoreconnect.apple.com/WebObjects/iTunesConnect.woa/ra/ng/app/${appId}/ios/ratingsResponses`;
          reviews.push(new Review(
            null,
            customerReviewID,
            customerReviewReviewerName,
            customerReviewRating,
            customerReviewTitle,
            customerReviewBody,
            customerReviewCreatedDateTimestamp,
            customerReviewTerritory,
            null,
            url
          ));

          if (latestCheckTimestamp === 0) {
            customerReviewsURL = null;
            break;
          }
        } 
      }
    }
    console.log(`[AppleFetcher] Fetch reviews in ${appId}, total reviews count: ${reviews.length}`);
    return reviews;
  }

  async fullFillAppInfo(reviews) {
    console.log('[AppleFetcher] Full fill app version information.');

    const customerReviewWhichAppVersionIsNil = reviews
      .filter((review) => review.appVersion === null)
      .map((review, index) => ({ id: review.id, index }));
    
    // Build AppStore Version API Request URL
    let appStoreVersionsLink = `https://api.appstoreconnect.apple.com/v1/apps/${appId}/appStoreVersions`

    while(appStoreVersionsLink) {
      const appStoreVersions = await this.request(appStoreVersionsLink);
      appStoreVersionsLink = appStoreVersions?.links?.next;

      console.log(`[AppleFetcher] List app store version, page url: ${appStoreVersionsLink}`);
      console.log(`[AppleFetcher] List app store version, versions count: ${appStoreVersions?.data?.length}`);
      
      for (const appStoreVersion of appStoreVersions?.data || []) {
        const applePlatform = appStoreVersion.attributes?.platform;
        const versionString = appStoreVersion.attributes?.versionString;

        let customerReviewsLink = appStoreVersion.relationships?.customerReviews?.links?.related;
        if (customerReviewsLink) {
          customerReviewsLink = `${customerReviewsLink}?sort=-createdDate&limit=200`;

          while(customerReviewsLink) {
            const customerReviews = await this.request(customerReviewsLink);
            customerReviewsLink = customerReviews?.links?.next;

            console.log(`[AppleFetcher] Fetch version reviews, page url: ${customerReviewsLink}`);
            console.log(`[AppleFetcher] Fetch version reviews, reviews count: ${customerReviews?.data?.length}`);

            for (const customerReview of customerReviews?.data || []) {
              const customerReviewID = customerReview.id;
              if (!customerReviewID) { continue; }

              const findIndex = customerReviewWhichAppVersionIsNil.findIndex((value) => value.id === customerReviewID);
              if (findIndex !== -1) {
                const findResult = customerReviewWhichAppVersionIsNil[findIndex];
                reviews[findResult.index].appVersion = versionString;
                reviews[findResult.index].platform = applePlatform;

                customerReviewWhichAppVersionIsNil.splice(findIndex, 1);

                console.log(`[AppleFetcher] Count of reviews need full fill app version: ${customerReviewWhichAppVersionIsNil.length}`);

                if (customerReviewWhichAppVersionIsNil.length < 1) {
                  customerReviewsLink = null;
                  break;
                }
              }
            }
            if (!customerReviewsLink) { break; }
          }
        }

        if (customerReviewWhichAppVersionIsNil.length < 1) {
          appStoreVersionsLink = null;
          break;
        }
      }
    }
    return reviews;
  }

  async request(url, retryCount = 0) {
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          // Construct Headers, including authentication data
          'Authorization': `Bearer ${jwtToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        const responseBody = await response.text();
        const result = JSON.parse(responseBody);

        if (retryCount >= 5) {
          throw new Error(`Could not connect to api.appstoreconnect.apple.com, error message: ${JSON.stringify(result)}`);
        } else {
          return this.request(url, retryCount + 1);
        }
      } else {
        const responseBody = await response.text();
        return JSON.parse(responseBody);
      }
    } catch (error) {
      throw new Error(`Error in request: ${error.message}`);
    }
  }
}

module.exports = AppleFetcher;