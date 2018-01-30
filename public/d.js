
var code = getUrlParam('code') || sessionStorage.code;
sessionStorage.openid = 'oeATN0jUj8ZTF8juzrtEhfvRzf5s';
var openid = sessionStorage.openid;

// 没有 openid 则尝试获取 code
// code 获取之后跳回原链接进行临时存储
if (!openid) {
  if (!code) {
    var redirect_uri = encodeURIComponent('http://z.hdk4.com/d.html');
    window.location.href = 'https://open.weixin.qq.com/connect/oauth2/authorize?appid=wxbce0a3daf503097c&redirect_uri=' + redirect_uri + '&response_type=code&scope=snsapi_base&state=7';
  } else if (!sessionStorage.code) {
    sessionStorage.code = code;
    window.location.href = 'http://z.hdk4.com/d.html';
  }
}

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

var $iosActionsheet = $('#iosActionsheet');
var $iosMask = $('#iosMask');

function hideActionSheet() {
  $iosActionsheet.removeClass('weui-actionsheet_toggle');
  $iosMask.fadeOut(200);
}

$iosMask.on('click', hideActionSheet);
$('#iosActionsheetCancel').on('click', hideActionSheet);
$("#showIOSActionSheet").on("click", function () {
  $iosActionsheet.addClass('weui-actionsheet_toggle');
  $iosMask.fadeIn(200);
});

$('#app').on('click', '.weui-dialog__btn', function () {
  $(this).parents('.js_dialog').hide();
});

var $loadingToast = $('#loadingToast');
var $payResult = $('#payResult');

if (typeof WeixinJSBridge === "undefined") {
  document.addEventListener('WeixinJSBridgeReady', onBridgeReady, false);
}

function getOpenId() {
  return new Promise(function (resolve, reject) {
    if (sessionStorage.openid) {
      resolve(sessionStorage.openid);
    } else {
      $.get('/api/getopenid?code=' + sessionStorage.code).then(function (res) {
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

function onBridgeReady() {
  console.log('ready')
  $('#wxPay').click(function () {
    $iosActionsheet.removeClass('weui-actionsheet_toggle');
    $iosMask.hide();
    $loadingToast.fadeIn(100);

    getOpenId().then(function (openid) {
      $.get('/api/unifiedorder?openid=' + openid).then(function (res) {
        var data = res.data;
        $loadingToast.fadeOut(100);
        WeixinJSBridge.invoke('getBrandWCPayRequest', {
          appId: data.appId, //公众号名称，由商户传入
          timeStamp: data.timeStamp, //时间戳，自1970年以来的秒数
          nonceStr: data.nonceStr, //随机串
          package: data.package,
          signType: data.signType, //微信签名方式:
          paySign: data.paySign //微信签名
        }, function (res) {
          $loadingToast.fadeOut(100);

          if (res.err_msg == 'get_brand_wcpay_request:ok') {
            $payResult.html('微信支付成功!');
          } else if (res.err_msg == 'get_brand_wcpay_request:cancel') {
            $payResult.html('用户取消支付!');
          } else {
            $payResult.html('支付失败!');
          }

          $('#iosDialog2').show();
        });

      });
    });
  });
}
