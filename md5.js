
const crypto = require('crypto');

function md5(str) {
  const ret = crypto.createHash('md5').update(str, 'utf8').digest('hex').toUpperCase();
  console.log(ret);
  return ret;
}

