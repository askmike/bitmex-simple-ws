const Connection = require('./con');

const a = new Connection();

// for auth simply pass key and secret:
// const a = new Connection({key: 'x', secret: 'y'});

a.connect()
  .then(() => {
    a.watchBook('XBTUSD', 'orderBookL2_25');
    a.on('orderBookL2_25:XBTUSD', b => {
      const book = b.get();
      console.log(book);
    });
  });




