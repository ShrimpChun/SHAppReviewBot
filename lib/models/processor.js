class Processor {
  constructor(platform) {
    this.platform = platform;
  }

  processReviews(reviews, platform) {
    // The logic for handling comments
  }

  renderReview(templateText, review, timeZoneOffset) {
    templateText = templateText.replace("%TITLE%", review.title || "");
    templateText = templateText.replace("%BODY%", review.body || "");
    templateText = templateText.replace("%RATING%", review.rating == null ? "" : review.rating.toString());
    templateText = templateText.replace("%PLATFORM%", review.platform || "");
    templateText = templateText.replace("%ID%", review.id || "");
    templateText = templateText.replace("%USERNAME%", review.userName || "");
    templateText = templateText.replace("%URL%", review.url || "");
    templateText = templateText.replace("%TERRITORY%", review.territory || "");
    templateText = templateText.replace("%TITLE%", review.title || "");
    templateText = templateText.replace("%APPVERSION%", review.appVersion || "");

    if (review.timestamp != null) {
      const createDate = new Date(review.timestamp * 1000);
      const localDate = new Date(createDate.getTime() - timeZoneOffset * 60 * 1000);
      templateText = templateText.replace("%CREATEDDATE%", localDate.toISOString());
    } else {
      templateText = templateText.replace("%CREATEDDATE%", "");
    }
    return templateText;
  }
}

module.exports = Processor;