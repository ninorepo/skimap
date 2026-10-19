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
Gunakan Bahasa Indonesia. Jangan mengarang fakta sejarah, tokoh, koordinat, bukti, atau URL.

Kembalikan JSON dengan format:
{
  "events": [
    {
      "year": "1945 M",
      "city": "Jakarta",
      "title": "Proklamasi Kemerdekaan Indonesia",
      "content": "<p>Deskripsi peristiwa...</p>",
      "longitude": 106.8456,
      "latitude": -6.2088,
      "categories": ["Politik"],
      "figures": ["Soekarno", "Mohammad Hatta"],
      "impact": "Indonesia memproklamasikan kemerdekaannya.",
      "evidences": ["Naskah Proklamasi"],
      "quiz": [
        {
          "question": "Siapa yang membacakan Proklamasi?",
          "options": [
            "Soekarno",
            "Soeharto",
            "B. J. Habibie",
            "Sutan Sjahrir"
          ],
          "correct": 0
        }
      ]
    }
  ]
}

Aturan:
- year berakhiran "M" atau "SM".
- Urutkan dari peristiwa tertua ke terbaru.
- content berisi 3–5 paragraf HTML.
- Gunakan hanya tag p, br, b, i, img, dan a.
- Gunakan URL gambar dan sumber hanya jika yakin benar.
- Koordinat harus berupa angka; perkiraan diperbolehkan.
- evidences berisi bukti sejarah konkret, bukan URL.
- Setiap peristiwa memiliki 3–5 soal kuis.
- Setiap soal memiliki 4 pilihan dan satu jawaban benar.
- correct adalah indeks jawaban benar, mulai dari 0.
- Gunakan [] jika data tidak diketahui.
- Jika tidak ada peristiwa relevan, kembalikan {"events":[]}.
- Keluarkan JSON saja, tanpa Markdown atau teks tambahan.
        `,

        input: post.prompt,
        text: {
          format: { type: "text" }
        }
      })
    }
  );

  if (!response.ok) {
    throw new Error(
      `AI error: ${response.status} ${await response.text()}`
    );
  }

  const data = await response.json();

  if (data.status !== "completed") {
    throw new Error("AI response was not completed");
  }

  const result = data.output
    .find(item => item.type === "message")
    ?.content.find(item => item.type === "output_text")
    ?.text;

  if (!result) {
    throw new Error("AI returned no history data");
  }

  let parsed;

  try {
    parsed = JSON.parse(result);
  } catch {
    throw new Error("AI returned invalid JSON");
  }

  return new Response(
    JSON.stringify(parsed.events || []),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json"
      }
    }
  );
}
/*
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
Aturan:
- Gunakan Bahasa Indonesia.
- Jangan mengarang fakta, tokoh, koordinat, bukti, atau URL.
- Keluarkan hanya JSON valid sesuai skema.
- Jika tidak ada peristiwa relevan, kembalikan {"events": []}.

Peristiwa:
- year: string berakhiran "M" atau "SM", contoh "1945 M", "350 SM".
- city: lokasi utama.
- title: judul singkat.
- content: 3–5 paragraf faktual dalam HTML. Hanya gunakan tag p, br, b, i, img, a.
- longitude, latitude: koordinat angka; gunakan perkiraan jika perlu.
- categories: kategori peristiwa.
- figures: tokoh penting.
- impact: dampak utama secara singkat.
- evidences: bukti sejarah konkret; gunakan [] jika tidak diketahui.

Gambar dan sumber:
- Tambahkan gambar dengan img dan referensi dengan a hanya jika URL dapat dipastikan benar.
- Prioritaskan Wikimedia Commons dan Wikipedia.
- Jangan menebak URL atau mengklaim telah memverifikasinya.
- Jangan gunakan URL dalam evidences.

Urutan:
- Urutkan events dari tertua ke terbaru.
- Tahun SM mendahului M; angka SM lebih besar berarti lebih tua.

Kuis:
- Setiap peristiwa memiliki 3–5 soal.
- Setiap soal memiliki question, options (tepat 4 string), dan correct (integer 0–3).
- Setiap soal hanya memiliki satu jawaban benar.
- Gunakan fakta yang dapat dipercaya; hindari pertanyaan ambigu dan pilihan duplikat.

Pemeriksaan:
- Semua properti wajib harus sesuai skema dan tipenya.
- Jangan menambahkan properti lain.
- Gunakan [] untuk array tanpa data yang dapat dipastikan.
- Pastikan HTML valid, koordinat berupa angka, dan urutan kronologis benar.
- Keluarkan JSON saja, tanpa Markdown atau teks tambahan.

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

              categories: {
                type: "array",
                items: { type: "string" }
              },
              figures: {
                type: "array",
                items: { type: "string" }
              },
              impact: { type: "string" },
              evidences: {
                type: "array",
                items: { type: "string" }
              },

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
              "categories",
              "figures",
              "impact",
              "evidences",
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

console.log("AI Error: ", response);
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
*/
/*

Aturan:
- Semua teks harus menggunakan Bahasa Indonesia.
- Jangan mengarang fakta, tokoh, koordinat, URL gambar, atau sumber referensi.
- Kembalikan {"events": []} jika tidak ada peristiwa yang relevan dengan permintaan.

Properti peristiwa:
- year: tahun sebagai string, gunakan akhiran "M" atau "SM", contoh "1945 M" atau "350 SM". Jangan gunakan tahun negatif atau nol.
- city: nama kota atau lokasi utama peristiwa.
- title: judul singkat dan deskriptif.
- content: penjelasan faktual dalam 3–5 paragraf menggunakan HTML valid. Hanya gunakan tag p, br, b, i, img, dan a.
- longitude dan latitude: koordinat geografis berupa angka. Jika lokasi tepat tidak diketahui, gunakan perkiraan lokasi utama yang relevan.
- categories: array kategori relevan, misalnya "Politik", "Perang", "Sains", atau "Budaya".
- figures: array nama tokoh penting yang terlibat dalam peristiwa.
- impact: string singkat tentang dampak utama dan konsekuensi jangka panjang jika relevan.
- evidences: array URL sumber tepercaya yang mendukung fakta peristiwa. Prioritaskan sumber berbahasa Indonesia, arsip, dokumen primer, museum, jurnal ilmiah, dan lembaga resmi.

Gambar dan sumber:
- Sertakan gambar relevan dalam content menggunakan <img src="URL" alt="deskripsi"> jika URL langsung gambar dapat dipastikan valid.
- Prioritaskan Wikimedia Commons atau Wikipedia. Jangan menebak URL atau menggunakan URL halaman artikel sebagai URL gambar.
- Sertakan tautan referensi relevan dalam content menggunakan <a href="URL" target="_blank">nama sumber</a>.
- Jangan mengarang atau mengklaim telah memverifikasi URL yang belum diperiksa. Jika gambar atau sumber tidak dapat dipastikan, jangan sertakan URL tersebut. Gunakan array evidences kosong jika tidak ada sumber yang dapat dipastikan.

Urutan:
- Urutkan events dari peristiwa tertua ke terbaru.
- Tahun SM mendahului tahun Masehi. Di antara tahun SM, angka yang lebih besar ditempatkan lebih dahulu.

Kuis:
- Setiap peristiwa wajib memiliki quiz berupa array berisi 3–5 soal pilihan ganda.
- Setiap soal memiliki question (string), options (array tepat 4 string), dan correct (integer 0–3).
- Setiap soal hanya memiliki satu jawaban benar. Pastikan correct menunjuk pada indeks jawaban yang benar.
- Pertanyaan harus berdasarkan fakta yang didukung sumber. Variasikan topik seperti penyebab, tokoh, kronologi, lokasi, dan dampak jika relevan.
- Hindari pertanyaan ambigu, pilihan duplikat, dan informasi yang tidak didukung sumber.

Pemeriksaan akhir:
- Ikuti skema JSON secara ketat. Semua properti wajib harus tersedia dan bertipe benar.
- Gunakan array kosong untuk categories, figures, atau evidences jika tidak ada data yang dapat dipastikan.
- Pastikan HTML valid, koordinat berupa angka, urutan kronologis benar, dan tidak ada properti tambahan.
- Keluarkan hanya JSON yang sesuai skema, tanpa teks tambahan.

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
*/

