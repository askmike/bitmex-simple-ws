const _ = require('lodash');

class Book {
  constructor() {
    this.initialized = false;

    this.levels = {};

    this.handle = this.handle.bind(this);
  }

  handle(e) {
    if(e.action === 'partial') {
      this.initBook(e);
      return;
    }

    if(this.initialized) {
      this[e.action](e);
    }
  }


  initBook(e) {
    this.insert(e);
    this.initialized = true;
  }

  update(e) {
    _.each(e.data, level => {
      this.levels[level.id].size = level.size;
      this.levels[level.id].side = level.side;
    });
  }

  insert(e) {
    _.each(e.data, level => {
      this.levels[level.id] = level;
    });
  }

  delete(e) {
    _.each(e.data, level => {
      delete this.levels[level.id];
    });
  }

  get() {
    const levels = _.values(this.levels);

    const asks = levels.filter(l => l.side === 'Sell')
    asks.sort((a, b) => a.price - b.price);

    const bids = levels.filter(l => l.side === 'Buy')
    bids.sort((a, b) => b.price - a.price);

    return {asks, bids};
  }

}

module.exports = Book;