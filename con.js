const WebSocket = require('ws');
const crypto = require('crypto');
const EventEmitter = require('events');

const Book = require('./book');

class Connection extends EventEmitter {

  constructor(auth) {

    super();

    this.connected = false;

    if(auth && auth.key && auth.secret) {
      this.isAuth = true;
      this.key = auth.key;
      this.secret = auth.secret;
    }

    this.subscription = {};
    this.book = {};

    this.bookTopics = [
      'orderBookL2_25',
      'orderBookL2'
    ];

    this.on('wsMessage', m => console.log(new Date, m));

  }

  getAuthHeaders() {
    const expiration = 60 * 1000;
    const start = +new Date;
    const expires = Math.round((start + expiration) / 1000);

    const signature = crypto.createHmac('sha256', this.secret)
      .update('GET' + '/realtime' + expires).digest('hex');

    return {
      'api-expires': expires,
      'api-key': this.key,
      'api-signature': signature
    }
  }

  disconnect() {
    this.ws.disconnect();
  }

  connect() {

    let options;

    if(this.isAuth) {
      options = {
        headers: this.getAuthHeaders()
      }
    }

    let readyHook;
    this.afterOpen = new Promise(r => readyHook = r);

    this.ws = new WebSocket('wss://www.bitmex.com/realtime', undefined, options);

    this.ws.onopen = () => {
      this.connected = true;
      readyHook();
      console.log('opened!');
    }

    this.ws.onerror = e => console.error('error', e);
    this.ws.onclose = e => console.log('onclose', e);

    this.ws.onmessage = this.handleMessage.bind(this);

    return this.afterOpen;
  }

  handleMessage(e) {
    const payload = JSON.parse(e.data);

    if(this.bookTopics.includes(payload.table)) {

      const { symbol } = payload.data[0];

      const id = `${payload.table}:${symbol}`;

      if(this.book[id]) {
        this.book[id].handle(payload);
        this.emit(id, this.book[id]);
        return;
      }
    }

    this.emit('wsMessage', payload);
  }

  rawSubscribe(topic) {

    if(this.subscription[topic]) {
      return;
    }

    this.ws.send(`{"op": "subscribe", "args": ["${topic}"]}`);

    this.subscription[topic] = true;
  }

  watchBook(symbol, topic = 'orderBookL2') {
    if(!this.bookTopics.includes(topic)) {
      throw new Error('This book topic is not supported');
    }

    const id = `${topic}:${symbol}`;

    if(this.book[id]) {
      return;
    }

    this.book[id] = new Book(id);
    this.rawSubscribe(id);
  }

}

module.exports = Connection;