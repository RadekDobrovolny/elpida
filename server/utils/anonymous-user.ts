import { randomUUID } from "node:crypto";
import { getCookie, setCookie, type H3Event } from "h3";

const COOKIE_NAME = "valerie_uid";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365 * 2;

function shouldUseSecureCookie(event: H3Event): boolean {
  const explicit = process.env.COOKIE_SECURE?.toLowerCase();
  if (explicit === "true") {
    return true;
  }
  if (explicit === "false") {
    return false;
  }

  const forwardedProto = event.node.req.headers["x-forwarded-proto"];
  if (typeof forwardedProto === "string") {
    return forwardedProto.split(",")[0].trim() === "https";
  }

  return false;
}

export function getAnonymousUserId(event: H3Event): string {
  const existingId = getCookie(event, COOKIE_NAME);
  if (existingId) {
    return existingId;
  }

  const id = randomUUID();
  setCookie(event, COOKIE_NAME, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: shouldUseSecureCookie(event),
    maxAge: COOKIE_MAX_AGE,
    path: "/"
  });
  return id;
}
