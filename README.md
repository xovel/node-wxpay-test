# node-wxpay-test

基于 node/express 的微信公众号支付测试

> **UNMAINTAINED**：鉴于帐号迁移和网站解析变更，原有的微信公众号已经不再继续使用，本项目原本设定的目标已经达成，现弃坑而去。

## Requirement

> 未做兼容性测试，本人测试使用的环境配置如下：

- `node v8.9.4`
- `nginx v1.12.2`

`nginx` 配置中，反向代理至 `node` 运行的 `express` 地址即可。

本人测试使用的配置文件如下：

```conf
server {
  listen 80;
  server_name z.hdk4.com;
  charset utf-8;
  location / {
    proxy_redirect off;
    proxy_set_header Host $http_host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-Proto https;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Host $remote_addr;
    proxy_pass http://localhost:2000/;
  }
}
```

## Run

要实际测试，需要先配置 `config.js` 中的相关参数和 `./public/d.js` 中的微信授权回调链接地址的相关参数并删除头部的 `sessionStorage.openid = 'oeATN0jUj8ZTF8juzrtEhfvRzf5s';` 这一句测试代码，~~是的，这是我个人的 `openid`~~，并将文件上传至服务器，然后使用手机微信进行访问即可。

文件上传到服务器后在该目录下安装依赖并执行脚本即可，推荐使用 `yarn` 进行安装。

1. `yarn` 或者 `npm install`
2. `node app`

## Note

更多信息请参阅本人的博客文章：[node 下的微信公众号支付初探](http://xovel.cn/article/node-wxpay.html)。
