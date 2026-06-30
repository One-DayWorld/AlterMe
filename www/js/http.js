// http.js — 统一 HTTP 出口
// 装到手机后优先用 CapacitorHttp(走原生层，绕过 WebView 跨域 + 不受 file:// 限制)。
// 浏览器开发期回退到 fetch(可能遇到跨域，仅开发期影响)。

const Net = (() => {
  const Http = window.Capacitor?.Plugins?.CapacitorHttp || null;
  const isNative = !!(window.Capacitor?.isNativePlatform?.());

  async function postJSON(url, headers, bodyObj) {
    const h = Object.assign({ 'Content-Type': 'application/json' }, headers || {});
    if (Http && isNative) {
      const res = await Http.request({ method: 'POST', url, headers: h, data: bodyObj, connectTimeout: 90000, readTimeout: 90000 });
      if (res.status < 200 || res.status >= 300) throw new Error(res.status + ': ' + JSON.stringify(res.data));
      return typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
    }
    const r = await fetch(url, { method: 'POST', headers: h, body: JSON.stringify(bodyObj) });
    if (!r.ok) throw new Error(r.status + ': ' + (await r.text()));
    return r.json();
  }

  async function getText(url, headers) {
    if (Http && isNative) {
      const res = await Http.request({ method: 'GET', url, headers: headers || {}, connectTimeout: 25000, readTimeout: 25000, responseType: 'text' });
      return typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
    }
    const r = await fetch(url, { headers: headers || {} });
    return await r.text();
  }

  return { postJSON, getText };
})();
