import {init,
	get_locations,
	get_content
} from "./backend.js"

export default{
	async fetch(req, env){
		const url = new URL(req.url);
		if( req.method === "GET" && url.pathname.startsWith("/api/init") )
			return init(req, env);
		if( req.method === "GET" && url.pathname.startsWith("/api/content") )
			return get_content(req, env);
		if( req.method === "GET" && url.pathname.startsWith("/api/locations") )
			return get_locations(req, env);
		if( req.method === "GET" && url.pathname.startsWith("/api/editor/list-histories") )
			return list_histories(req, env);
		if( req.method === "POST" && url.pathname.startsWith("/api/editor/add-history") )
			return add_history(req, env);
		if( req.method === "DELETE" && url.pathname.startsWith("/api/editor/delete-history") )
			return delete_history(req, env);
		if( req.method === "PUT" && url.pathname.startsWith("/api/editor/edit-history") )
			return edit_history(req, env);
		if( req.method === "POST" && url.pathname.startsWith("/api/auth") )
			return auth(req, env);
		if( req.method === "GET" && url.pathname.startsWith("/api/logout") )
			return logout(req, env);
	}
}


