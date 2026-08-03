import { onRequest as __api_approve_order_js_onRequest } from "C:\\Lavori\\_Escape the wheel\\fast-cheap-website\\functions\\api\\approve-order.js"
import { onRequest as __api_check_domain_js_onRequest } from "C:\\Lavori\\_Escape the wheel\\fast-cheap-website\\functions\\api\\check-domain.js"
import { onRequest as __api_create_addon_checkout_js_onRequest } from "C:\\Lavori\\_Escape the wheel\\fast-cheap-website\\functions\\api\\create-addon-checkout.js"
import { onRequest as __api_create_checkout_session_js_onRequest } from "C:\\Lavori\\_Escape the wheel\\fast-cheap-website\\functions\\api\\create-checkout-session.js"
import { onRequest as __api_generate_site_js_onRequest } from "C:\\Lavori\\_Escape the wheel\\fast-cheap-website\\functions\\api\\generate-site.js"
import { onRequest as __api_get_order_status_js_onRequest } from "C:\\Lavori\\_Escape the wheel\\fast-cheap-website\\functions\\api\\get-order-status.js"
import { onRequest as __api_get_session_js_onRequest } from "C:\\Lavori\\_Escape the wheel\\fast-cheap-website\\functions\\api\\get-session.js"
import { onRequest as __api_request_revision_js_onRequest } from "C:\\Lavori\\_Escape the wheel\\fast-cheap-website\\functions\\api\\request-revision.js"

export const routes = [
    {
      routePath: "/api/approve-order",
      mountPath: "/api",
      method: "",
      middlewares: [],
      modules: [__api_approve_order_js_onRequest],
    },
  {
      routePath: "/api/check-domain",
      mountPath: "/api",
      method: "",
      middlewares: [],
      modules: [__api_check_domain_js_onRequest],
    },
  {
      routePath: "/api/create-addon-checkout",
      mountPath: "/api",
      method: "",
      middlewares: [],
      modules: [__api_create_addon_checkout_js_onRequest],
    },
  {
      routePath: "/api/create-checkout-session",
      mountPath: "/api",
      method: "",
      middlewares: [],
      modules: [__api_create_checkout_session_js_onRequest],
    },
  {
      routePath: "/api/generate-site",
      mountPath: "/api",
      method: "",
      middlewares: [],
      modules: [__api_generate_site_js_onRequest],
    },
  {
      routePath: "/api/get-order-status",
      mountPath: "/api",
      method: "",
      middlewares: [],
      modules: [__api_get_order_status_js_onRequest],
    },
  {
      routePath: "/api/get-session",
      mountPath: "/api",
      method: "",
      middlewares: [],
      modules: [__api_get_session_js_onRequest],
    },
  {
      routePath: "/api/request-revision",
      mountPath: "/api",
      method: "",
      middlewares: [],
      modules: [__api_request_revision_js_onRequest],
    },
  ]