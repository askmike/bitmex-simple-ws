const WebSocket = require('ws');
const crypto = require('crypto');
const EventEmitter = require('events');

class Connection extends EventEmitter {

  constructor(auth) {

    super();

    this.connected = false;

    if(auth && auth.key && auth.secret) {
      this.isAuth = true;
      this.key = auth.key;
      this.secret = auth.secret;
    }

    this.subscriptions = [];
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

    this.ws.onerror = e => this.emit('error', e);
    this.ws.onclose = e => this.emit('close', e);

    this.ws.onmessage = this.handleMessage.bind(this);

    return this.afterOpen;
  }

  handleMessage(e) {
    const payload = JSON.parse(e.data);
    this.emit('message', payload);
  }

  subscribe(topic) {

    if(this.subscriptions.includes(topic)) {
      return;
    }

    this.ws.send(`{"op": "subscribe", "args": ["${topic}"]}`);

    this.subscriptions.push(topic);
  }

}

module.exports = Connection;