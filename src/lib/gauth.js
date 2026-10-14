/*
 * Verify a Google OpenID Connect ID token and check whether
 * the Google account is registered in the database.
 *
 * Arguments:
 *   env - Cloudflare Worker environment object.
 *         Requires:
 *           env.DBBINDING        D1 database binding
 *           env.GOOGLE_CLIENT_ID Google OAuth client ID
 *   jwt - Google ID token (JWT) received from the client.
 *
 * Returns:
 *   false - Token is invalid, expired, has an invalid signature,
 *           has invalid claims, or the Google account is not registered in local databse.
 *
 *   object - retrn decoded payload in object form
 * Usage:
 *   const result = await verifyGoogleToken(env, jwt);
 *
 *   if (!result) {
 *       return new Response("Unauthorized", { status: 401 });
 *   }
 *
 *   // Authenticated user:
 *   console.log(result);
 */

export function gauth_jwt_decode(jwt){
	const parts = jwt.split(".");
        if (parts.length !== 3) return false;

        const [headerB64, payloadB64, signatureB64] = parts;

        const decode = (str) => {
            str = str.replace(/-/g, "+").replace(/_/g, "/");
            while (str.length % 4) str += "=";
            return Uint8Array.from(atob(str), c => c.charCodeAt(0));
        };
	
	const header = JSON.parse(
            new TextDecoder().decode(decode(headerB64))
        );

        const payload = JSON.parse(
            new TextDecoder().decode(decode(payloadB64))
        );

	return {header, payload};
}

export async function gauth_jwt_verify(client_id, jwt) {
    try {   
	const parts = jwt.split(".");
//console.log("JWT Parts: ", parts);
//console.log("JWT Parts Length: ", parts.length);
	if (parts.length !== 3) return false;
        const [headerB64, payloadB64, signatureB64] = parts;
        const {header, payload} = gauth_jwt_decode(jwt);

//console.log("Header: ", header);
//console.log("Payload: ", payload);
        // Google ID tokens currently use RS256
        if (header.alg !== "RS256" || !header.kid) {
            return false;
        }

        // Basic claim validation
        if (
            payload.iss !== "https://accounts.google.com" &&
            payload.iss !== "accounts.google.com"
        ) {
	    return false;
        }

        if (payload.aud !== client_id) {
            return false;
	}

        if (!payload.sub || !payload.exp) {
            return false;
        }

        if (payload.exp <= Math.floor(Date.now() / 1000)) {
            return false;
        }

        // Get Google's current public keys
        const response = await fetch(
            "https://www.googleapis.com/oauth2/v3/certs"
        );
//console.log("Oauth Cert Response: ", response);
        if (!response.ok) return false;

        const jwks = await response.json();
//console.log("JWKs: ", jwks);
        const jwk = jwks.keys.find(
            key => key.kid === header.kid && key.alg === "RS256"
        );
//console.log("JWK :", jwk);
        if (!jwk) return false;

        // Import Google's RSA public key
        const publicKey = await crypto.subtle.importKey(
            "jwk",
            jwk,
            {
                name: "RSASSA-PKCS1-v1_5",
                hash: "SHA-256"
            },
            false,
            ["verify"]
        );
//console.log("Public Key: ", publicKey);
        // Verify JWT signature
        const validSignature = await crypto.subtle.verify(
            "RSASSA-PKCS1-v1_5",
            publicKey,
            base64urlToBytes(signatureB64),	// decode base64, the convert the result to bytes
            new TextEncoder().encode(
                `${headerB64}.${payloadB64}`	// no need for base 64 decode, convert base64 to bytes as is
            )
        );
//console.log("Valid Signature: ", validSignature);
        if (!validSignature) return false;	
	return true;	
    } catch (e) {
//console.log("ERROR: ", e);
        return false;
    }
}

export async function gauth_user_exist(db, jwt){
	if(!jwt)
		return false;
	// Check whether this Google account is registered
	const {header, payload} = gauth_jwt_decode(jwt);
        const user = await db
            .prepare(
                "SELECT * FROM tb_gmail WHERE email = ?"
            )
            .bind(payload.email)
            .first();

        if (!user) return false;
        return true;
}

export async function gauth_user_get(db, email){
	try{
	const rows = await db.prepare(`
		select 
			g.email, 
			r.role,
			o.org
        	from tb_gmail_role_org gro
		join 
			tb_gmail g
			on 
				g.id = gro.email_id
		join 
			tb_role r
			on 
				r.id = gro.role_id
		left join 
			tb_org o
			on
				o.id = gro.org_id
		where
			g.email = ?
    	`).bind(email).all();

	return rows.results;
	} catch(e){
		return null;
	}
}

export async function gauth_user_add(db, email, role, org){
	try{
		// upodate bridge table
		await db.prepare("insert or ignore into tb_gmail (email) values (?)").bind(email).run();
		await db.prepare("insert or ignore into tb_org (org) values (?)").bind(org).run();
		await db.prepare(`
			insert into tb_gmail_role_org (email_id, role_id, org_id) values (
				(select id from tb_gmail where email = ?), 
				(select id from tb_role where role = ?), 
				(select id from tb_org where org = ?)
			);
		`).bind(email, role, org).run();
	} 
	catch(e){
		console.error("gauth.js: gauth_user_add()", e);
		return false
	}
	return true;
}

function base64urlToBytes(str) {
    str = str.replace(/-/g, "+").replace(/_/g, "/");

    while (str.length % 4) {
        str += "=";
    }

    const binary = atob(str);

    return Uint8Array.from(
        binary,
        c => c.charCodeAt(0)
    );
}

