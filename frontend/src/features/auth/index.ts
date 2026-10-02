/**
 * auth feature folder (Unit 02). Login, roles and sessions live here: the login page
 * (role picker + credentials), the session store, and the per-role placeholder
 * landing route. Real role screens arrive in later units.
 */
export { LoginPage } from "./LoginPage";
export { RoleHomePage } from "./RoleHomePage";
export {
  login,
  logout,
  loadSession,
  saveSession,
  clearSession,
  landingPath,
  ROLE_SLUGS,
} from "./session";
export type { Role, RoleSlug, Session } from "./session";
