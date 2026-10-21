/**
 * HTTP layer for the BigScreen module (Unit 09). The big screen is a receive-only
 * WebSocket spoke (hub-and-spoke, ARCH-022): it is gated by the `bigScreenLinkToken`
 * at the Socket.io handshake and thereafter only *receives* `ranking:update` pushes
 * — it sends nothing and reads nothing over HTTP. There is therefore no HTTP route
 * on this module; the router is exported only to keep the decided module layout
 * (BLD-020) uniform and to give `routes.ts` a stable mount. The controller-driven
 * display switching commands (Unit 11) will add real routes here.
 */
import { Router } from "express";

export const bigScreenRouter = Router();
