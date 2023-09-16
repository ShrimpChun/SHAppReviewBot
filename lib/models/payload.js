class Payload {
  constructor() {
    this.channel = '';
    this.attachments = [];
  }

  toJSON() {
    return {
      channel: this.channel,
      attachments: this.attachments.map(attachments => attachments.toJSON()),
    };
  }
}

module.exports = Payload;