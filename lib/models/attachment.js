class Attachment {
  constructor(color, fallback, title, text, authorName, footer) {
    this.color = color;
    this.fallback = fallback;
    this.title = title;
    this.text = text;
    this.authorName = authorName;
    this.footer = footer
  }

  toJSON() {
    return {
      color: this.color,
      fallback: this.fallback,
      title: this.title,
      text: this.text,
      authorName: this.authorName,
      footer: this.footer,
    };
  }
}

module.exports = Attachment;