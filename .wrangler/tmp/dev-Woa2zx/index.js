const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// .wrangler/tmp/bundle-LtleJY/checked-fetch.js
const urls = /* @__PURE__ */ new Set();
function checkURL(request, init) {
  const url = request instanceof URL ? request : new URL(
    (typeof request === "string" ? new Request(request, init) : request).url
  );
  if (url.port && url.port !== "443" && url.protocol === "https:") {
    if (!urls.has(url.toString())) {
      urls.add(url.toString());
      console.warn(
        `WARNING: known issue with \`fetch()\` requests to custom HTTPS ports in published Workers:
 - ${url.toString()} - the custom port will be ignored when the Worker is published using the \`wrangler deploy\` command.
`
      );
    }
  }
}
__name(checkURL, "checkURL");
globalThis.fetch = new Proxy(globalThis.fetch, {
  apply(target, thisArg, argArray) {
    const [request, init] = argArray;
    checkURL(request, init);
    return Reflect.apply(target, thisArg, argArray);
  }
});

// src/workers/media-rewrite/index.ts
const media_rewrite_default = {
  async fetch(request, env) {
    const url = new URL(request.url);
    let path = url.pathname;
    path = decodeURIComponent(path);
    let rewrittenPath = path;
    if (rewrittenPath.startsWith("/media/_thumbs/")) {
      const inner = rewrittenPath.slice(15);
      if (inner.startsWith("Engagement/Photos/")) {
        const filename = inner.slice(18);
        rewrittenPath = `professional/photos/proposal/${  filename}`;
      } else if (inner.startsWith("Bach+ette/Photos/") || inner.startsWith("Bach ette/Photos/")) {
        const filename = inner.slice(17);
        let mappedName = filename;
        if (mappedName.endsWith(".webp")) {
          mappedName = `${mappedName.slice(0, -5)  }.jpg`;
        }
        rewrittenPath = `media/Bach+ette/Photos/${  mappedName}`;
      } else if (inner.startsWith("Professional/Wedding Day/Photos/")) {
        let filename = inner.slice(32);
        if (filename.endsWith(".webp")) {
          filename = `${filename.slice(0, -5)  }.jpg`;
        }
        rewrittenPath = `media/Professional/Wedding Day/Photos/${  filename}`;
      } else if (inner.startsWith("Professional/")) {
        const afterPro = inner.slice(12);
        const slashIdx = afterPro.indexOf("/");
        if (slashIdx > 0) {
          const album = afterPro.slice(0, slashIdx);
          const rest = afterPro.slice(slashIdx + 1);
          rewrittenPath = `media/Professional/${album}/Photos/${  rest}`;
        }
      } else if (inner.startsWith("Guest Uploads/") || inner.startsWith("GuestUploads/")) {
        const afterGuest = inner.slice(14);
        const stillsIdx = afterGuest.indexOf("Stills/");
        if (stillsIdx > 0) {
          let filename = afterGuest.slice(stillsIdx + 7);
          if (filename.endsWith(".webp")) {
            filename = `${filename.slice(0, -5)  }.jpg`;
          }
          rewrittenPath = `media/Guest Uploads/Wedding Day/Live Photos/Stills/${  filename}`;
        } else {
          let filename = afterGuest;
          if (filename.endsWith(".webp")) {
            filename = `${filename.slice(0, -5)  }.jpg`;
          }
          rewrittenPath = `media/Guest Uploads/${  filename}`;
        }
      } else {
        rewrittenPath = `media/${  inner}`;
      }
    } else if (rewrittenPath.startsWith("/_thumbs/")) {
      const inner = rewrittenPath.slice(9);
      if (inner.startsWith("Engagement/Photos/")) {
        const filename = inner.slice(18);
        rewrittenPath = `professional/photos/proposal/${  filename}`;
      } else if (inner.startsWith("Bach+ette/Photos/") || inner.startsWith("Bach ette/Photos/")) {
        const filename = inner.slice(17);
        let mappedName = filename;
        if (mappedName.endsWith(".webp")) {
          mappedName = `${mappedName.slice(0, -5)  }.jpg`;
        }
        rewrittenPath = `media/Bach+ette/Photos/${  mappedName}`;
      } else if (inner.startsWith("Professional/Wedding Day/Photos/")) {
        let filename = inner.slice(32);
        if (filename.endsWith(".webp")) {
          filename = `${filename.slice(0, -5)  }.jpg`;
        }
        rewrittenPath = `media/Professional/Wedding Day/Photos/${  filename}`;
      } else if (inner.startsWith("Professional/")) {
        const afterPro = inner.slice(12);
        const slashIdx = afterPro.indexOf("/");
        if (slashIdx > 0) {
          const album = afterPro.slice(0, slashIdx);
          const rest = afterPro.slice(slashIdx + 1);
          rewrittenPath = `media/Professional/${album}/Photos/${  rest}`;
        }
      } else if (inner.startsWith("Guest Uploads/") || inner.startsWith("GuestUploads/")) {
        const afterGuest = inner.slice(14);
        const stillsIdx = afterGuest.indexOf("Stills/");
        if (stillsIdx > 0) {
          let filename = afterGuest.slice(stillsIdx + 7);
          if (filename.endsWith(".webp")) {
            filename = `${filename.slice(0, -5)  }.jpg`;
          }
          rewrittenPath = `media/Guest Uploads/Wedding Day/Live Photos/Stills/${  filename}`;
        } else {
          let filename = afterGuest;
          if (filename.endsWith(".webp")) {
            filename = `${filename.slice(0, -5)  }.jpg`;
          }
          rewrittenPath = `media/Guest Uploads/${  filename}`;
        }
      } else {
        rewrittenPath = `media/${  inner}`;
      }
    } else if (rewrittenPath.startsWith("/media/Bach+ette/")) {
      rewrittenPath = path.slice(1);
    } else if (rewrittenPath.startsWith("/media/Professional/")) {
      rewrittenPath = path.slice(1);
    } else if (rewrittenPath.startsWith("/media/")) {
      rewrittenPath = path.slice(7);
    } else if (rewrittenPath.startsWith("/background_audio/")) {
      rewrittenPath = rewrittenPath.slice(1);
    }
    try {
      const object = await env.MEDIA_BUCKET.get(rewrittenPath);
      if (!object) {
        return new Response(`Not Found: ${rewrittenPath}`, {
          status: 404,
          headers: { "Content-Type": "text/plain" }
        });
      }
      return new Response(object.body, {
        headers: {
          "Content-Type": object.httpMetadata?.contentType || "application/octet-stream",
          "Cache-Control": "public, max-age=31536000, immutable"
        }
      });
    } catch (e) {
      return new Response(`Error: ${e.message}`, { status: 500 });
    }
  }
};

// ../../AppData/Roaming/npm/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
const drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
const middleware_ensure_req_body_drained_default = drainBody;

// ../../AppData/Roaming/npm/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
const jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
const middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-LtleJY/middleware-insertion-facade.js
const __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
const middleware_insertion_facade_default = media_rewrite_default;

// ../../AppData/Roaming/npm/node_modules/wrangler/templates/middleware/common.ts
const __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-LtleJY/middleware-loader.entry.ts
const __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name((type, init) => {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
let WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
const middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
