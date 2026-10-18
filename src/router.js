import {
	verify,
	google_auth,
	assistant_ask
} from "./backend.js"

export default{
	async fetch(req, env){
		const url = new URL(req.url);
		if( req.method === "GET" && url.pathname.startsWith("/api/user/verify"))
			return verify(req, env);
		if( req.method === "POST" && url.pathname.startsWith("/api/user/auth") )
			return google_auth(req, env);
		if( req.method === "GET" && url.pathname.startsWith("/api/user/logout") )
			return logout(req, env);
		if( req.method === "POST" && url.pathname.startsWith("/api/assistant/ask") )
			return assistant_ask(req, env);
	}
}


