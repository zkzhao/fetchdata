/**
 * Fetch网络请求库
 *
 * @auhor: zkzhao
 * @date: 2018/9/5
 * @version: v1.1
 * @email: zzk_312@163.com
 */
import { NavigationActions } from "react-navigation";
import { Toast } from "antd-mobile";
import forge from "node-forge";
import Storage from "./storage";

const appKey = "***";
const appSecret = "***";
/**
 * md5转换
 * @param {json} reqBodyParms request的参数
 */
function md5(reqBodyParms) {
  const sign =
    `appKey=${appKey}&appSecret=${appSecret}&body=` +
    JSON.stringify(reqBodyParms);
  let md = forge.md.md5.create();
  md.update(sign);
  const mdStr = md.digest().toHex();
  return mdStr;
}
/**
 * 创建header对象
 * @param {json} opts 实例化时传的参数用于新增header参数
 */
async function _headers(opts) {
  let myHeaders = new Headers({
    "Content-Type": "application/json",
    Accept: "application/json"
  });
  // 判断是否有传入的需要加入Header里的参数
  if (opts && opts.head) {
    for (let key in opts.head) {
      myHeaders.set(key, opts.head[key]);
    }
  }
  // 获取身份令牌
  let Authorization = await Storage.getItem("Authorization");
  // 获取缓存中的登陆信息
  global.merchCode = await Storage.getItem("merchCode");
  global.merchAcct = await Storage.getItem("merchAcct");
  // console.log(Authorization);
  if (Authorization) {
    myHeaders.append("Authorization", Authorization);
  } else {
    myHeaders.append("appKey", appKey);
    myHeaders.append("sign", md5(opts.reqBodyParms));
  }
  return myHeaders;
}
/**
 * 创建request请求
 * @param {String} method 请求方式
 * @param {String} url 请求地址
 * @param {JsonString} reqBodyParms 请求传递的参数(GET通过header传递,POST通过body传递)
 * @param {Headers} headers 请求头
 * @param {JsonString} optbodys 扩展功能的参数
 */
async function _Request(method, url, reqBodyParms, headers, optbodys) {
  let myInit = {};
  let newRequest = null;
  let head = await headers;
  if (method === "GET") {
    myInit = { method, headers: head };
    newRequest = new Request(url + reqBodyParms, myInit);
  } else {
    myInit = { method, headers: head, body: reqBodyParms };
    newRequest = new Request(url, myInit);
  }
  return this._fetch_request(newRequest, optbodys);
}
/**
 * request 请求逻辑开始
 * @param {Fn} newRequest Request主体
 * @param {JsonString} optbodys 扩展功能的参数
 */
_Request.prototype._fetch_request = async function(newRequest, optbodys = {}) {
  let setTime,
    time = 0,
    neterror = false,
    _this = this;
  try {
    // 判断扩展功能参数noload是否为真;
    if (!optbodys.noload) {
      // 超过3秒的请求才出现加载中字样
      setTime = setInterval(function() {
        time++;
        if (time > 3 && !neterror) {
          Toast.loading("加载中...", 50);
          clearInterval(setTime);
        }
      }, 100);
    }

    let resjson = await this._fetch(fetch(newRequest), 10000)
      .then(response => {
        // 判断返回的请求头状态是否200,否则返回错误
        if (response.status >= 200 && response.status < 300) {
          return response;
        }
        // 400为业务错误码
        if (response.status === 400) {
          // 业务逻辑错误处理
          _this._fetchErrorCode(response);
          return response;
        }
        const error = new Error(response.statusText);
        error.response = response;
        throw error;
      })
      .then(response => {
        return response.json();
      })
      .catch(e => {
        console.log(e);
        Toast.info("服务器繁忙，请稍后重试~", 1.5);
      })
    clearInterval(setTime);
    if (time > 3) Toast.hide();
    return resjson;
  } catch (e) {
    console.log("网络请求失败:" + e);
    neterror = true;
    Toast.info("服务器繁忙，请稍后重试~", 1.5);
  }
};
/**
 * 增加请求超时处理
 *
 * @param {Promise} fetch_promise fetch请求的promise
 * @param {Number} timeout 超时时间
 * @returns 返回一个增加了超时abort的新fetch请求
 */
_Request.prototype._fetch = function(fetch_promise, timeout) {
  let abort_fn = null;

  //可被reject的promise
  let abort_promise = new Promise(function(resolve, reject) {
    abort_fn = function() {
      reject("请求超时,已结束该请求");
    };
  });

  //这里使用Promise.race，以最快 resolve 或 reject 的结果来传入后续绑定的回调
  let abortable_promise = Promise.race([fetch_promise, abort_promise]);

  setTimeout(function() {
    abort_fn();
  }, timeout);

  return abortable_promise;
};
/**
 * 业务逻辑错误码判断
 * @param {Promise} response 服务端返回的数据
 */
_Request.prototype._fetchErrorCode = async function(response) {
  // clone response 避免 Already read
  const resjson = await response.clone().json();
  if (
    resjson.code === 10002 ||
    resjson.code === 10019 ||
    resjson.code === 10020
  ) {
    // 登陆过期
    Storage.setItem("Authorization", "");
    const resetAction = NavigationActions.reset({
      index: 0,
      actions: [NavigationActions.navigate({ routeName: "Login" })]
    });
    global.nav.dispatch(resetAction);
  }
};

var FetchData = function() {
  return new FetchData.prototype.init(arguments);
};

FetchData.fn = FetchData.prototype = {
  constructor: FetchData,
  init: function(params) {
    if (!params) {
      return this;
    }
    this.options = {};
    // 请求头参数
    this.options.head = params[1];
    // 配置项
    this.options.body = params[0];
    return this;
  }
};

FetchData.fn.init.prototype = FetchData.fn;

FetchData.extend = FetchData.fn.extend = function() {
  var options,
    copy,
    target = arguments[0] || {},
    i = 1,
    length = arguments.length;
  if (i === length) {
    target = this;
    i--;
  }
  for (; i < length; i++) {
    if ((options = arguments[i]) != null) {
      for (name in options) {
        copy = options[name];
        target[name] = copy;
      }
    }
  }
  return target;
};
FetchData.fn.extend({
  /**
   * get、post、put请求 (用于扩展请求多样化需要)
   * @param {string} url 请求地址
   * @param {json} reqBodyParms 请求体body的数据
   * 实例属性 options 接收headers参数
   */
  get: function(url, reqBodyParms) {
    let optheaders = _headers({ head: this.options.head });
    return FetchData.get(url, reqBodyParms, optheaders, this.options.body);
  },
  post: function(url, reqBodyParms) {
    let optheaders = _headers({ head: this.options.head, reqBodyParms });
    return FetchData.post(url, reqBodyParms, optheaders, this.options.body);
  },
  put: function(url, reqBodyParms) {
    let optheaders = _headers({ head: this.options.head, reqBodyParms });
    return FetchData.put(url, reqBodyParms, optheaders, this.options.body);
  }
});
FetchData.extend({
  /**
   * get、post、put请求 (实际的请求静态方法)
   * @param {string} url 请求地址
   * @param {json} reqBodyParms 请求体body的数据
   * @param {header} optheaders 头信息
   * @param {JsonString} optbodys 扩展功能的参数
   */
  get: function(url, reqBodyParms, optheaders, optbodys) {
    // header用来判断是实例方法调用(optheaders)还是静态方法调用(_headers())
    let header = optheaders || _headers({ reqBodyParms });
    let params = "";

    if (reqBodyParms) {
      // get请求拼接url (参数跟url一起传递)
      for (let item in reqBodyParms) {
        params += "&" + item + "=" + reqBodyParms[item];
      }
      params = "?" + params.substr(1);
    }
    return new _Request("GET", url, params, header, optbodys);
  },
  post: function(url, reqBodyParms, optheaders, optbodys) {
    let header = optheaders || _headers({ reqBodyParms });
    return new _Request(
      "POST",
      url,
      JSON.stringify(reqBodyParms),
      header,
      optbodys
    );
  },
  put: function(url, reqBodyParms, optheaders, optbodys) {
    let header = optheaders || _headers({ reqBodyParms });
    return new _Request(
      "PUT",
      url,
      JSON.stringify(reqBodyParms),
      header,
      optbodys
    );
  }
});

export default FetchData;
