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
- year adalah string dengan format tahun Masehi menggunakan akhiran "M" atau tahun Sebelum Masehi menggunakan akhiran "SM". Contoh: "1945 M", "350 SM". Jangan gunakan tahun negatif atau nol.
- city berisi nama kota atau lokasi utama peristiwa.
- title adalah judul singkat dan deskriptif tentang peristiwa.
- content menjelaskan peristiwa secara faktual dalam 3 sampai 5 paragraf. Gunakan HTML yang valid dan hanya tag berikut: p, br, b, i, img, dan a.
- Tambahkan gambar relevan dari internet menggunakan tag img dengan URL gambar yang valid. Jangan mengarang URL gambar. wajib menyertakan gambar pada tiap content.
- Sertakan tautan referensi web berbahasa Indonesia yang relevan dan dapat dipercaya. Gunakan tag a dengan atribut target="_blank" agar tautan dibuka di tab baru. Jangan mengarang URL referensi.
- longitude dan latitude adalah koordinat geografis lokasi peristiwa, masing-masing berupa angka.
- Jangan mengarang fakta sejarah, koordinat, gambar, atau sumber referensi. Jika lokasi tepat tidak diketahui, gunakan koordinat perkiraan kota atau lokasi utama yang paling relevan.
- Urutkan semua peristiwa berdasarkan year dari yang paling lama ke yang paling baru. Tahun SM harus ditempatkan sebelum tahun Masehi, dengan tahun SM yang lebih besar secara numerik ditempatkan lebih dahulu.
- Setiap peristiwa wajib memiliki properti quiz berupa array berisi 3 sampai 5 soal pilihan ganda yang menguji pemahaman terhadap peristiwa tersebut.
- Setiap soal dalam quiz harus memiliki:
  - question: pertanyaan yang jelas dalam Bahasa Indonesia.
  - options: array berisi tepat 4 pilihan jawaban dalam Bahasa Indonesia, dengan hanya satu jawaban yang benar.
  - correct: indeks berbasis nol dari jawaban yang benar, berupa integer dari 0 sampai 3.
- Buat pertanyaan berdasarkan fakta yang dijelaskan dalam peristiwa terkait. Hindari pertanyaan ambigu, pilihan jawaban duplikat, dan informasi yang tidak didukung sumber. Variasikan pertanyaan agar mencakup penyebab, tokoh, kronologi, lokasi, atau dampak peristiwa jika relevan.
- Pastikan nilai correct benar-benar menunjuk pada pilihan yang tepat dalam options.
- Kembalikan array events kosong jika tidak ada peristiwa relevan. Jangan menghasilkan peristiwa atau soal kuis yang tidak relevan dengan permintaan.

Aturan gambar:
- Gunakan gambar yang benar-benar ada dan relevan dengan peristiwa sejarah.
- Jangan membuat, menebak, atau mengarang URL gambar berdasarkan nama file, judul, atau pola URL.
- Prioritaskan gambar dari Wikimedia Commons atau Wikipedia.
- Gunakan URL gambar langsung yang mengarah ke file gambar, bukan URL halaman artikel atau halaman galeri.
- Jika tidak dapat memastikan URL gambar yang valid, jangan sertakan gambar. Jangan menggantinya dengan URL hasil tebakan.
- Masukkan gambar ke dalam content menggunakan tag img dengan atribut src berisi URL gambar dan alt berisi deskripsi gambar.
- Jangan mengklaim bahwa gambar telah diverifikasi jika URL-nya belum benar-benar diperiksa.
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
              latitude: { type: "number" },
              quiz: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    question: { type: "string" },
                    options: {
                      type: "array",
                      items: { type: "string" }
                    },
                    correct: { type: "integer" }
                  },
                  required: [
                    "question",
                    "options",
                    "correct"
                  ],
                  additionalProperties: false
                }
              }
            },
            required: [
              "year",
              "city",
              "title",
              "content",
              "longitude",
              "latitude",
              "quiz"
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

/*
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
 * */
