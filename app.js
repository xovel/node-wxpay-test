'use strict';

const fs = require('fs');
const path = require('path');
// const os = require('os');

const express = require('express');
const app = express(); // express 实例

const request = require('request'); // HTTP 请求库

const cors = require('cors'); // express 的中间件 cors，用于开启跨域请求

// 解析 xml
const xml2jsparseString = require('xml2js').parseString;

// 配置文件
const config = require('./config.js');

// node 的加密相关模块，内置 md5 方法
const crypto = require('crypto');

const log = console.log;

const bodyParser = require('body-parser');
require('body-parser-xml')(bodyParser);

// 解决微信支付通知回调数据
app.use(bodyParser.xml({
  limit: '1MB',   // Reject payload bigger than 1 MB
  xmlParseOptions: {
    normalize: true,     // Trim whitespace inside text nodes
    normalizeTags: true, // Transform tags to lowercase
    explicitArray: false // Only put nodes in array if >1
  }
}));

// nginx 代理 ip 追溯
app.set('trust proxy', 'loopback');

// 静态页面
app.use(express.static(path.join(__dirname, 'public')));

// 开启跨域
app.use(cors());

// 获取 openid
app.get('/api/getopenid', function (req, res) {
  const code = req.query.code;
  const access_token_url = `https://api.weixin.qq.com/sns/oauth2/access_token?appid=${config.app_id}&secret=${config.app_secret}&code=${code}&grant_type=authorization_code`;

  request.post({ url: access_token_url }, function (error, response, body) {
    wFile('openid', body);
    if (error) {
      res.json({ error: body });
    } else if (response.statusCode === 200) {
      if (body.errcode === 40029 ) {
        res.json({ error: body });
      } else {
        body = JSON.parse(body);
        res.json({ data: body });
      }
    } else {
      res.json({ error: -1 });
    }
  });
});

// 获取微信支付的统一下单相关数据
app.get('/api/unifiedorder', function (req, res) {
  const openid = req.query.openid;
  const ip = getClientIp(req);

  // 商户订单号
  const out_trade_no = 'test' + new Date().getTime();

  // 统一下单的相关参数
  const paramUnifiedOrder = {
    appid: config.app_id,
    attach: 'test',
    body: 'desc',
    mch_id: config.mch_id,
    nonce_str: createNonceStr(),
    notify_url: config.notify_url, // 微信付款后的回调地址
    openid: openid,
    out_trade_no: out_trade_no,
    spbill_create_ip: ip,
    total_fee: 1,
    trade_type: 'JSAPI'
  };

  // 签名
  paramUnifiedOrder.sign = getSign(paramUnifiedOrder);

  // 请求微信支付下单接口，获取预订单编号
  request.post({ url: 'https://api.mch.weixin.qq.com/pay/unifiedorder', body: JSON.stringify(getUnifiedOrderXml(paramUnifiedOrder)) }, function (error, response, body) {
    wFile('unifiedorder', body);
    if (error) {
      res.json({ error: body });
    } else if (response.statusCode === 200) {
      let prepay_id = ''; // 预订单编号
      // 微信返回的数据为 xml 格式，需要进行解析
      xml2jsparseString(body, { async: true }, function (error, result) {
        prepay_id = result.xml.prepay_id[0]; // 获取预订单编号
        const paramWCPay = {
          appId: config.app_id,
          timeStamp: parseInt(new Date().getTime() / 1000).toString(),
          nonceStr: createNonceStr(),
          package: 'prepay_id=' + prepay_id,
          signType: 'MD5'
        };
        paramWCPay.paySign = getSign(paramWCPay); // 微信支付签名
        res.json({ data: paramWCPay });
      });
    } else {
      res.json({ error: -1 });
    }
  });

});

// 处理微信支付的回调
app.post('/api/wxresponse', function (req, res) {
  wFile('response', req.body);

  let xmlData = req.body.xml;
  let ret = '';
  if (xmlData.sign === getSign(xmlData)) {
    ret = `<xml>
  <return_code><![CDATA[SUCCESS]]></return_code>
  <return_msg><![CDATA[OK]]></return_msg>
</xml>`;
  } else {
    ret = `<xml>
  <return_code><![CDATA[SIGNATRURE_ERROR]]></return_code>
  <return_msg><![CDATA[FAIL]]></return_msg>
</xml>`;
  }
  res.send(ret);

});

// 监听本机 2000 端口
const server = app.listen(2000, function () {
  const port = server.address().port;
  console.log('Project listening at http://localhost:%s', port);
});

// 获取客户端 IP 地址
function getClientIp(req) {
  let remoteAddress = req.headers['x-forwarded-for'] ||
    req.connection.remoteAddress ||
    req.socket.remoteAddress ||
    req.connection.socket.remoteAddress;
  return (String(remoteAddress).match(/(\d+\.\d+\.\d+\.\d+)/) || [])[1] || '';
}

// 封装统一下单的 xml 数据
function getUnifiedOrderXml(obj) {
  const body = '<xml>' +
    '<appid>' + obj.appid + '</appid>' +
    '<attach>' + obj.attach + '</attach>' +
    '<body>' + obj.body + '</body>' +
    '<mch_id>' + config.mch_id + '</mch_id>' +
    '<nonce_str>' + obj.nonce_str + '</nonce_str>' +
    '<notify_url>' + obj.notify_url + '</notify_url>' +
    '<openid>' + obj.openid + '</openid>' +
    '<out_trade_no>' + obj.out_trade_no + '</out_trade_no>' +
    '<spbill_create_ip>' + obj.spbill_create_ip + '</spbill_create_ip>' +
    '<total_fee>' + obj.total_fee + '</total_fee>' +
    '<trade_type>' + obj.trade_type + '</trade_type>' +
    '<sign>' + obj.sign + '</sign>' +
    '</xml>';
  return body;
}

// 签名算法
function getSign(paramSign) {
  // 按 key 值的 ascii 排序
  const keys = Object.keys(paramSign).sort();
  const temp = [];
  keys.forEach(v => {
    if (paramSign[v] && v !== 'sign') {
      temp.push(`${v}=${paramSign[v]}`);
    }
  });
  temp.push(`key=${config.mch_key}`);

  const ret = temp.join('&');
  // 生成签名
  return crypto.createHash('md5').update(ret, 'utf8').digest('hex').toUpperCase();
}

// 生成一个随机字符串
function createNonceStr() {
  return Math.random().toString(36).substr(2, 15);
}

// 时间日期格式化
function dateFormat(v, format = 'YYYY-MM-DD') {
  let _date = v instanceof Date ? v : new Date(v);

  if (isNaN(_date.getTime())) {
    // 日期转换失败则原值返回
    return v;
  }

  let ret = format;

  var o = {
    'M+': _date.getMonth() + 1, // month
    'd+': _date.getDate(), // day
    'D+': _date.getDate(), // day
    'h+': _date.getHours(), // hour
    'm+': _date.getMinutes(), // minute
    's+': _date.getSeconds(), // second
    'S': _date.getMilliseconds() // millisecond
  };

  // 年份处理
  ret = ret.replace(/y+/i, function (year) {
    return ('' + _date.getFullYear()).substr(4 - year.length);
  });

  // 其他格式化处理
  for (var k in o) {
    ret = ret.replace(new RegExp(k), function (v) {
      // 补零操作
      if (v.length > 1) {
        return ('00' + o[k]).substr(('' + o[k]).length);
      }
      return o[k];
    });
  }

  return ret;
}

if (!fs.existsSync('cache')) {
  fs.mkdirSync('cache');
}

// 写入文件
function wFile(name, content) {
  const curName = name + '_' + dateFormat(new Date(), 'yyyy_MM_dd_hh_mm_ss_') + createNonceStr() + '.txt';
  const filePath = path.join(__dirname, 'cache', curName);
  fs.writeFile(filePath, JSON.stringify(content), (err) => {
    if (err) {
      console.log(`${filePath} 写入失败 ${err}`);
    } else {
      console.log(`${filePath} 写入成功`);
    }
  });
}

