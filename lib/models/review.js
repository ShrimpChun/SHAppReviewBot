class Review {
  constructor(platform, id, userName, rating, title, body, timestamp, territory, appVersion, url) {
    this.platform = platform; // The Platform
    this.id = id; // The Review ID
    this.userName = userName; // The Reviewer
    this.rating = rating; // Rating Given, 1 - 5 Stars
    this.title = title; // The Review Title
    this.body = body; // The Review Content
    this.timestamp = timestamp; // The Review Creation Time
    this.territory = territory; // The Region
    this.appVersion = appVersion // The App Version
    this.url = url // The Review Link (Apple has not yet provided a way to link to a specific review in the backend)
  }
}

module.exports = Review;