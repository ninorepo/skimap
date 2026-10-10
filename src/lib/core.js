/*****************************
 * DECLARATIONS
 ****************************
export async function GET(req) :object
export async function POST(req, type = "json") :object
export function COOKIE(req) :object
function duration(value) :milliseconds
export async function SESSION(kv, sessionId) :object			table format should follow: sessions(id, json, expire)
export async function sessionNew(kv, object, expire) :sessionId		
export async function sessionDel(kv, sessionId) :bool
*/

export async function GET(req) {
  const url = new URL(req.url);
  const result = {};

  for (const [key, value] of url.searchParams) {
    // If the same key appears multiple times, keep all values.
    if (key in result) {
      result[key] = Array.isArray(result[key])
        ? [...result[key], value]
        : [result[key], value];
    } else {
      result[key] = value;
    }
  }

  return result;
}

export async function POST(req) {
  const type = req.headers.get("Content-Type");
  switch (type.toLowerCase()) {
    case "application/json":
      return await req.json();

    case "application/x-www-form-urlencoded": {
      const text = await req.text();
      const params = new URLSearchParams(text);
      const result = {};

      for (const [key, value] of params) {
        if (key in result) {
          result[key] = Array.isArray(result[key])
            ? [...result[key], value]
            : [result[key], value];
        } else {
          result[key] = value;
        }
      }

      return result;
    }

    case "raw":
      return await req.text();

    default:
      throw new Error(`Unsupported POST type: ${type}`);
  }
}

export function COOKIE(req) {
  const cookieHeader = req.headers.get("Cookie");

  if (!cookieHeader) {
    return {};
  }

  const cookies = {};

  for (const part of cookieHeader.split(";")) {
    const index = part.indexOf("=");

    if (index === -1) continue;

    const name = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();

    cookies[name] = decodeURIComponent(value);
  }

  return cookies;
}

// Convert a duration into milliseconds.
//
// Number:
//   5000        -> 5000ms
//
// String:
//   "500ms"     -> 500ms
//   "5s"        -> 5 seconds
//   "3m"        -> 3 minutes
//   "2h"        -> 2 hours
//   "7d"        -> 7 days
//   "2w"        -> 2 weeks
function duration(value) {
  // Numbers are treated as milliseconds.
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value < 0) {
      throw new TypeError("Invalid duration");
    }

    return value;
  }

  if (typeof value !== "string") {
    throw new TypeError("Invalid duration");
  }

  const match = value
    .trim()
    .match(/^(\d+(?:\.\d+)?)\s*(ms|s|m|h|d|w)$/i);

  if (!match) {
    throw new Error(
      'Invalid duration. Use "500ms", "5s", "3m", "2h", "7d", or "1w".'
    );
  }

  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();

  const multiplier = {
    ms: 1,
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
    w: 7 * 24 * 60 * 60 * 1000
  };

  return amount * multiplier[unit];
}


// Retrieve a session.
//
// Returns:
//   session object -> session exists and has not expired
//   null           -> session does not exist or has expired
//
// Expired sessions are automatically deleted.
export async function SESSION(kv, req) {
  const cookies = COOKIE(req);
  if (!cookies.sessid) {
    return null;
  }
  const value = await kv.get("sessid:"+cookies.sessid);
  if(!value)
	return null;
  try {
    return JSON.parse(value);
  } catch {
    // Invalid JSON means the session cannot be used.
    return null;
  }
}


// Create a new session.
//
// `expire` can be:
//   5000   -> 5 seconds
//   "5s"   -> 5 seconds
//   "2h"   -> 2 hours
//   "7d"   -> 7 days
//
// Returns the generated session ID.
export async function session_new(kv, object, expire) {
  const sessid = crypto.randomUUID();
  // Convert the supplied duration into an absolute
  // expiration timestamp.
  // divide to 1000, convert to seconds 
  const expireAt = (Date.now() + duration(expire)) / 1000;
  await kv.put("sessid:" + sessid, JSON.stringify(object), {expirationTtl: expireAt});
  return sessid;
}

// Delete a session.
//
// Returns:
//   true  -> session existed and was deleted
//   false -> session did not exist
export async function session_del(kv, sessid) {
  if (!sessid) {
    return false;
  }
  kv.delete(sessid);
  const check = await kv.get("sessid:" + sessid);
  return check?true:false ;
}
