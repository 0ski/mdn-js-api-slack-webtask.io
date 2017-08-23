const wt = require('./wt.js');

console.log(wt({
  body: {
    text: 'array join',
  },
}, (donotcare, obj) => console.log(obj)));


console.log(wt({
  body: {
    text: 'find',
  },
}, (donotcare, obj) => console.log(obj)));

console.log(wt({
  body: {
    text: 'fsdfsd sdf sdf sd fsd sdf ',
  },
}, (donotcare, obj) => console.log(obj)));

console.log(wt({
  body: {
    text: 'WebAPI',
  },
}, (donotcare, obj) => console.log(obj)));
