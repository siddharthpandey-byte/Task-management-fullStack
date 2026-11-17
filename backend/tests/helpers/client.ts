import request from "supertest";
import app from "../../src/app.js";
import { API_PREFIX } from "../../src/constants.js";

let ipCounter = 1;
// unique client IP per test client so rate limiters don't bleed between tests (trust proxy = 1)
const nextIp = () =>
  `10.${(ipCounter >> 16) & 255}.${(ipCounter >> 8) & 255}.${ipCounter++ & 255}`;

// A cookie-keeping browser-like client
export function createClient() {
  const agent = request.agent(app);
  const ip = nextIp();
  const url = (path: string) => `${API_PREFIX}${path}`;

  return {
    get: (path: string) => agent.get(url(path)).set("X-Forwarded-For", ip),
    post: (path: string, body?: object) =>
      agent.post(url(path)).set("X-Forwarded-For", ip).send(body),
    patch: (path: string, body?: object) =>
      agent.patch(url(path)).set("X-Forwarded-For", ip).send(body),
    del: (path: string) => agent.delete(url(path)).set("X-Forwarded-For", ip),
  };
}

export const VALID_USER = {
  name: "Ada Lovelace",
  email: "ada@example.com",
  password: "Sup3rSecret!",
};

// parses Set-Cookie into { name: { value, attributes } }
export function parseSetCookies(header: string | string[] | undefined) {
  const list = Array.isArray(header) ? header : header ? [header] : [];
  return Object.fromEntries(
    list.map((raw) => {
      const [pair, ...attrs] = raw.split(";").map((part) => part.trim());
      const [name, ...value] = pair.split("=");
      return [
        name,
        {
          value: value.join("="),
          attributes: attrs.map((a) => a.toLowerCase()),
        },
      ];
    })
  );
}
