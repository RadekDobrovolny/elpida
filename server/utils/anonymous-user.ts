import { randomUUID } from "node:crypto";
import { getCookie, setCookie, type H3Event } from "h3";

const COOKIE_NAME = "valerie_uid";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365 * 2;

export function getAnonymousUserId(event: H3Event): string {
  const existingId = getCookie(event, COOKIE_NAME);
  if (existingId) {
    return existingId;
  }

  const id = randomUUID();
  setCookie(event, COOKIE_NAME, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: COOKIE_MAX_AGE,
    path: "/"
  });
  return id;
}
