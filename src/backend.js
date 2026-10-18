import {GET, POST, COOKIE, SESSION,
	session_new
} from "./lib/core.js"
import {
	gauth_jwt_decode,
	gauth_jwt_verify,
	gauth_user_exist,
	gauth_user_get
}
from "./lib/gauth.js"


export async function verify(req, env){
	const session = await SESSION(env.KV, req);
	if(!session)
		return new Response(JSON.stringify({
			success: false,
			code: "UNAUTHORIZED",
			message: "Unauthorized access",
		}), {status: 401});
	return new Response(JSON.stringify({
			success: true,
			code: "AUTHORIZED",
			message: "Logged in",
			user: {
				picture: session.picture,
				username: session.name,
				email: session.email
			}
	}), {status: 200});
}

export async function google_auth(req, env){
	// reject auth if already signed in\
	const current_session = await SESSION(env.KV, req);
	if(current_session)
		return new Response(JSON.stringify(
			{	success: true, 
				code: "ALREADY_AUTHENTICATED", 
				message:"You're Already Logged In"
			}), 
			{status: 200});

	// get jwt
	const data = await req.json();
	const jwt = data.credential;
	const {header, payload} = gauth_jwt_decode(jwt);
	const email = payload.email;

	// jwt verify
	if( !await gauth_jwt_verify(env.GOOGLE_CLIENT_ID, jwt) )
		return new Response(JSON.stringify(
			{	success: false,
				code: "JWT_VERIFICATION_FAILED",
				message: "JWT Verification was Failed"
			}), {status: 403});
	
	// db verify if sub is registered in local DB
	if( !await gauth_user_exist(env.DB, jwt) )
		return new Response(JSON.stringify(
			{	success: false,
				code: "UNREGISTERED_USER",
				message: "Unregistered User"
			}), {status: 403});
	// new session
	const rows = await gauth_user_get(env.DB, email);
	if(!rows)
		return new Response(JSON.stringify(
			{	success: false,
				code: "USER_INFO_NOT_FOUND",
				message: "Unregistered User"
			}), {status: 403});
	const sessdata = {
		picture: payload.picture,
		name: payload.name,
		email: payload.email,	
		roles: rows.map(row => row.role),
		sites: rows.map(row => row.org)
	};
	const sessid = await session_new(env.KV, sessdata, "3d");	
	// redirect to admin
	return new Response(JSON.stringify(
		{	success: true,
			code: "LOGIN_SUCCESS",
			message: "Logged In"
		}), {status: 200, headers: {
					"Set-Cookie": "sessid="+sessid+"; Max-Age=864000; Path=/; HttpOnly; Secure"	}
	});
}

export async function assistant_ask(req, env) {
  const post = await POST(req);
  const prompt = post.prompt;

  const response = await fetch(
    "https://api.koboillm.com/v1/responses",
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.GPT_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "openai/gpt-6-luna",
        instructions: `
${prompt}

Aturan:
- Semua teks harus dalam Bahasa Indonesia.
- year adalah string menggunkanan M untuk masehi dan SM untuk sebelum masehi tidak boleh negative atau nol
- city berisi nama kota atau lokasi utama peristiwa.
- title adalah judul singkat peristiwa.
- content menjelaskan peristiwa secara faktual 3 sampai 5 paragraf. mendukung html tag: p, br, b, i, img, a. tambahkan gambar dari internet. sertakan link referensi web berbahasa indonesia, harus buka tab baru.
- longitude dan latitude adalah koordinat geografis lokasi.
- Jangan mengarang fakta sejarah atau koordinat jika tidak diketahui.
- Jika lokasi tepat tidak diketahui, gunakan koordinat perkiraan kota atau lokasi utama yang paling relevan.
- Urutkan hasil berdasarkan year dari terkecil ke terbesar.
- Kembalikan array kosong jika tidak ada peristiwa relevan.
        `,
        input: prompt,
        text: {
          format: {
            type: "json_schema",
            name: "history_data",
            strict: true,
            schema: {
              type: "object",
              properties: {
                events: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      year: { type: "string" },
                      city: { type: "string" },
                      title: { type: "string" },
                      content: { type: "string" },
                      longitude: { type: "number" },
                      latitude: { type: "number" }
                    },
                    required: [
                      "year",
                      "city",
                      "title",
                      "content",
                      "longitude",
                      "latitude"
                    ],
                    additionalProperties: false
                  }
                }
              },
              required: ["events"],
              additionalProperties: false
            }
          }
        }
      })
    }
  );

  if (!response.ok) {
    throw new Error(
      `OpenAI API error: ${response.status} ${await response.text()}`
    );
  }

  const data = await response.json();

  if (data.status !== "completed") {
    throw new Error("OpenAI response was not completed");
  }

  const result = data.output
    .find(item => item.type === "message")
    ?.content.find(item => item.type === "output_text")
    ?.text;

  if (!result) {
    throw new Error("OpenAI returned no history data");
  }

  const parsed = JSON.parse(result);

  return new Response(JSON.stringify(parsed.events), {status: 200});
}
