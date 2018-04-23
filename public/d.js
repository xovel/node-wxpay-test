(function (window, $) {

// // 解决 click 点击事件的延时
// $(function () {
//   FastClick.attach(document.body);
// });

/**
 * 提取链接中的字段值
 * @param {String} name 待搜索的字段名
 * @param {String} url 被检索的链接，默认为当前网页路径
 * @param {Boolean} raw 是否直接返回取得的结果（即不进行解码操作）
 * @return 对应的字段值，如果该值没有，则返回空串
 */
function getUrlParam(name, url, raw) {
  if (!url) {
    url = window.location.search;
  }

  if (!name || !url) {
    return '';
  }

  var param = '';
  var reg = new RegExp('(^|&|\\?)' + name + '=([^&#]*)(&|$|#)', 'i');
  var ret = url.match(reg);

  if (ret) {
    param = raw ? ret[2] : decodeURIComponent(ret[2]);
  }

  return param;
};

// 用户的访问 code
var code = getUrlParam('code') || sessionStorage.code;
// 记录用户的 openid
var openid = sessionStorage.openid;
// 获取 code 的传回链接
var redirect_uri = encodeURIComponent('http://z.hdk4.com/d.html');
// 公众号 id
var wx_appid = 'wxbce0a3daf503097c';
// 获取 code 的微信链接
var wx_code_uri = 'https://open.weixin.qq.com/connect/oauth2/authorize?appid=' + wx_appid + '&redirect_uri=' + redirect_uri + '&response_type=code&scope=snsapi_base&state=7';
// 本页重定向链接
var me_uri = 'http://z.hdk4.com/d.html';

var deviceId = getUrlParam('d') || 'mytest1';

// 服务器配置信息
var server_protocal = 'http';
var server_host = '39.108.72.98';
var server_port = 9999;

var server_uri = server_protocal + '://' + server_host + (server_port === 80 ? '' : ':' + server_port);

// 调用的参数
var ajaxUrl = {
  openid: server_uri + '/wx/v1/account/getWxOpenId',
  wxpay: server_uri + '/pay/v1/weChatPay-info'
};

// 没有 openid 则尝试获取 code
// code 获取之后跳回原链接进行临时存储
if (!openid) {
  if (!code) {
    window.location.replace(wx_code_uri);
  } else if (!sessionStorage.code) {
    sessionStorage.code = code;
    window.location.replace(me_uri);
  }
}

// 页面元素相关变量
var $app = $('#app');
// 页面蒙层
var $mask = $('#smc-mask');
// 底部弹出层
var $actionSheet = $('#smc-action-sheet');
// 选择按钮
var $btnSelect = $('#btn-select');
// 取消按钮
var $btnCancel = $('#btn-cancel');
// 加载中
var $loading = $('#smc-loading');
// 对话框
var $dialog = $('#smc-dialog');
// 操作结果
var $result = $('#smc-result');
// // 用户协议
// var $rule = $('#smc-rule');
// // 协议点击详情
// var $btnRule = $('#btn-rule');

// 隐藏支付模块
function hideActionSheet() {
  $actionSheet.removeClass('weui-actionsheet_toggle');
  $mask.fadeOut(200);
}

$mask.click(hideActionSheet);
$btnCancel.click(hideActionSheet);

$btnSelect.click(function () {
  $actionSheet.addClass('weui-actionsheet_toggle');
  $mask.fadeIn(200);
});

// 对话框关闭
$app.on('click', '.weui-dialog__btn', function () {
  $(this).parents('.js_dialog').hide();
});

// 微信内浏览器可用
if (typeof WeixinJSBridge === 'undefined') {
  document.addEventListener('WeixinJSBridgeReady', onBridgeReady, false);
}

// 弹出对话框提示
function showMsg(msg) {
  $loading.hide();
  $mask.hide();
  $dialog.show();
  $result.html(msg);
}

function onBridgeReady() {
  console.log('ready');

  $('#pay-java').click(function () {
    payIt('java');
  });

  $('#pay-node').click(function () {
    payIt('node');
  });

}

// 获取 openid
function getOpenId(mode) {
  return new Promise(function (resolve, reject) {
    if (sessionStorage.openid) {
      resolve(sessionStorage.openid);
    } else {
      var url = mode === 'node' ? '/api/getopenid' : ajaxUrl.openid;
      $.get(url + '?code=' + sessionStorage.code).then(function (res) {
        var data = res.data;
        if (data && data.openid) {
          sessionStorage.openid = data.openid;
          resolve(data.openid)
        } else {
          reject();
        }
      });
    }
  });
}

function payCallback(res) {
  if (res.err_msg === 'get_brand_wcpay_request:ok') {
    showMsg('微信支付成功!');
  } else if (res.err_msg === 'get_brand_wcpay_request:cancel') {
    showMsg('用户取消支付!');
  } else {
    showMsg('支付失败!');
  }
}

// 支付操作
function payIt(mode) {
  $actionSheet.removeClass('weui-actionsheet_toggle');
  $mask.hide();
  $loading.fadeIn(100);

  getOpenId(mode).then(function (openid) {
    if (mode === 'node') {
      $.get('/api/unifiedorder?openid=' + openid).then(function (res) {
        var data = res.data;
        $loading.fadeOut(100);
        WeixinJSBridge.invoke('getBrandWCPayRequest', {
          appId: data.appId,
          timeStamp: data.timeStamp,
          nonceStr: data.nonceStr,
          package: data.package,
          signType: data.signType,
          paySign: data.paySign
        }, payCallback);
      }).catch(function () {
        showMsg('请求错误');
      });
    } else {
      var orderNo = 'test' + new Date().getTime();
      var postData = {
        openId: openid,
        orderNo: orderNo,
        payAmount: 1,
        useTime: 2,
        chairCode: deviceId
      };
      $.ajax({
        url: ajaxUrl.wxpay,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        timeout: 30000,
        type: 'POST',
        data: JSON.stringify(postData),
        success: function (res) {
          var resCode = +res.code;
          var data = res.data;
          $loading.fadeOut(100);
          if (resCode === 0 || resCode === 200) {
            WeixinJSBridge.invoke('getBrandWCPayRequest', {
              appId: wx_appid,
              timeStamp: data.timeStamp,
              nonceStr: data.nonceStr,
              package: 'prepay_id=' + data.prepayId,
              signType: 'MD5',
              paySign: data.paySign
            }, payCallback);
          } else {
            showMsg('数据错误，错误码：' + resCode);
          }
        },
        error: function () {
          showMsg('请求错误');
        }
      });
    }
  });
}

})(window, jQuery);
