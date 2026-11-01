"use strict";

function createRouter() {
  const routes = [];

  function add(method, pattern, handler) {
    const keys = [];
    const regex = new RegExp("^" + pattern.replace(/\/:([A-Za-z]+)(?=\/|$)/g, function (_m, key) {
      keys.push(key);
      return "/([^/]+)";
    }) + "/?$");
    routes.push({ method: method, regex: regex, keys: keys, handler: handler });
  }

  function resolve(method, pathname) {
    for (const route of routes) {
      if (route.method !== method) continue;
      const match = route.regex.exec(pathname);
      if (!match) continue;
      const params = {};
      route.keys.forEach(function (key, index) {
        params[key] = decodeURIComponent(match[index + 1]);
      });
      return { handler: route.handler, params: params };
    }
    return null;
  }

  return {
    get: function (p, h) { add("GET", p, h); },
    post: function (p, h) { add("POST", p, h); },
    put: function (p, h) { add("PUT", p, h); },
    resolve: resolve
  };
}

module.exports = { createRouter: createRouter };
