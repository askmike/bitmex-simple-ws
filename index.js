const WebSocket = require('ws');
const crypto = require('crypto');
const EventEmitter = require('events');

const wait = n => new Promise(r => setTimeout(r, n));

class Connection extends EventEmitter {

  constructor(auth) {

    super();

    this.connected = false;
    this.reopen = true;

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

  reconnect = async () => {

    if(!this.reopen) {
      return;
    }

    this.connect();

    await this.afterOpen;

    await wait(200);

    this.subscriptions.forEach(sub => {
      sub.active = false;
      this.subscribe(sub.name);
    });
  }

  disconnect() {
    this.reopen = false;
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
      console.log('[BITMEX] opened!');
    }

    const onError = e => {
      if(
        e.message === 'Unexpected server response: 403' ||
        e.message === 'Unexpected server response: 429'
      ) {
        throw new Error(`[BITMEX] received "${.message}" need to back off reconnecting`)
      }

      console.log(new Date, '[BITMEX] error', e.message);
    }

    this.ws.on('error', onError)
    this.ws.onerror = onError;

    this.ws.onclose = async e => {
      console.log(new Date, '[BITMEX] close');
      this.emit('close');
      this.connected = false;
      await wait(1000);
      this.reconnect();
    }

    this.ws.onmessage = this.handleMessage;

    return this.afterOpen;
  }

  handleMessage = e => {
    const payload = JSON.parse(e.data);
    this.emit('message', payload);
  }

  subscribe(topic) {

    let registration;
    this.subscriptions.forEach(sub => {
      if(sub.name === topic) {
        registration = sub;
      }
    });

    if(registration && registration.active) {
      console.log(new Date, '[BITMEX] refusing to subscribe to same topic twice', topic);
      return;
    }

    if(!registration) {
      this.subscriptions.push({name: topic, active: true});
    } else if(!registration.active) {
      registration.active = true;
    }

    this.ws.send(`{"op": "subscribe", "args": ["${topic}"]}`);
  }

}

module.exports = Connection;