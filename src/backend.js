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

export async function init(req, env){
	// fetch all available years
	const query = await env.DB.prepare("select year from tb_year").all();
	if(!query.success)
		return new Response(JSON.stringify({
			success: false,
			code: "YEARS_NOT_FOUND",
			message: "Years not found"
		}), {status: 404});
	const years = query.results.map(row => row.year);
	const payload = {
		success: true,
		code: "YEARS_LOADED",
		message: "Years loaded succesfully",
		years
	};

	return new Response(JSON.stringify(payload), {status: 200});

}

/*
 * Get all  locaitons base on selected year
 */
export async function get_locations(req, env){
	// get year
	const get = await GET(req);
	const year = get.year;

	// fetch locations based on year
	const query = await env.DB.prepare(`
			select 
tb_location.city,
				tb_location.latitude,
				tb_location.longitude
			from 
				tb_content
			join 
				tb_year
					on tb_content.year_id = tb_year.id
			join 
				tb_location 
					on tb_content.location_id = tb_location.id
			where
				tb_year.year = ?
		`).bind(year).all();

	if(!query.success)
		return new Response(JSON.stringify({
			success: false,
			code: "YEARS_NOT_FOUND",
			message: "Years not found"
		}), {status: 404});

	const rows = query.results;
	const payload = {
		success: true,
		code: "LOCATIONS_LOADED",
		message: "Locations are loaded successfully",
		year,
		locations: rows.map(row => 
			({ city: row.city,
			lon: row.longitude, 
			lat: row.latitude }))
	};

	return new Response(JSON.stringify(payload), {status: 200});

}

/*
 * get content based on selected year and location
 */
export async function get_contents(req, env){
	const get = await GET(req);
	// get selected year
	const year = get.year;
	// get selected location
	const city = get.city;
	// fetch content where year = sellected year and location = selected location
	//console.log("Year, City: ", year);
	//console.log("City: ", city)
	const query = await env.DB.prepare(`
				select
				title, content
			from
				tb_content
			join
				tb_year
				on tb_year.id = tb_content.year_id
			join
				tb_location
				on tb_location.id = tb_content.location_id
			where
				tb_year.year = ? and tb_location.city = ?
		`).bind(year, city).all();
	if(!query.success)
		return new Response(JSON.stringify({
			success: false,
			code: "CONTENTS_NOT_FOUND",
			message: "Contents not found"
		}), {status: 404});
	const rows = query.results;
	//console.log("ROWS: ", rows);
	const payload = {
		success: true,
		code: "CONTENTS_LOADED",
		message: "Contents are loaded successfully",
		year,
		city,
		contents: rows.map(row => ({title: row.title, content: row.content}))
	};

	return new Response(JSON.stringify(payload), {status: 200});

}

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

export async function list_locations(req, env){
	// check sesion
	const session = await SESSION(env.KV, req);
	if(!session)
		return new Response(JSON.stringify({
			success: false,
			code: "UNAUTHORIZED",
			message: "Unauthorized access",
		}), {status: 401});

	// query
	const query = await env.DB.prepare("select city from tb_location").all();
	// return
	const payload = {
		success: true,
		code: "HISTORY_FOUND",
		message: "History was found",
		cities: query.results.map( elem => elem.city )
	};
	return new Response(JSON.stringify(payload), {status: 200});
}


/*
 * List 
 * */
export async function list_histories(req, env){
	// check session
	const session = await SESSION(env.KV, req);
	if(!session)
		return new Response(JSON.stringify({
			success: false,
			code: "UNAUTHORIZED",
			message: "Unauthorized access",
		}), {status: 401});

	// get ?page=n&num=n offset=(page-1)*num
	const get = await GET(req);
	const query_1 = await env.DB.prepare("select count(*) from tb_content").first();
	const total_rows = query_1.total;
	const total_pages = Math.ceil(total_rows/get.rows);
	const page = get.page;
	const offset = (page-1)*get.rows;
	// query
	const query_2 = await env.DB.prepare(`
		select
			tb_content.id,
			tb_year.year,
			tb_location.city,
			tb_location.latitude,
			tb_location.longitude,
			tb_content.title,
			tb_content.content
		from tb_content
		join tb_year
			on tb_year.id = tb_content.year_id
		join tb_location
			on tb_location.id = tb_content.location_id
		limit ? offset ?
		`).bind(get.rows, offset).all();
	const histories = query_2.results;
	const payload = {
		success: true,
		code: "LIST_HISTORIES",
		message: "list histories successsfully",
		total_pages,
		total_rows,
		page: get.page,
		rows: get.rows,
		histories
	};
	return new Response(JSON.stringify(payload), {status: 200});
	// return
	/*
	 {
		success: true,
		code: LIST_HISTORIES,
		message: "list histories successfully",
		total_pages: n,
		page: x,
		total_rows:x,
		num: n,
		histories: [
			{
				id,
				modified_time,
				year,
				city,
				title,
				content
			} ...
		]
	 }	
	 */
}

export async function get_history(req, env){
	// check sesion
	const session = await SESSION(env.KV, req);
	if(!session)
		return new Response(JSON.stringify({
			success: false,
			code: "UNAUTHORIZED",
			message: "Unauthorized access",
		}), {status: 401});

	// get id
	const get = await GET(req);
	
	// query
	const query = await env.DB.prepare(`
		select
			tb_content.id,
			tb_year.year,
			tb_location.city,
			tb_location.latitude,
			tb_location.longitude,
			tb_content.title,
			tb_content.content
		from tb_content
		join tb_year
			on tb_year.id = tb_content.year_id
		join tb_location
			on tb_location.id = tb_content.location_id
		where 
			tb_content.id = ?
	`).bind(get.id).first();
	// return
	const payload = {
		success: true,
		code: "HISTORY_FOUND",
		message: "History was found",
		history: query
	};
	return new Response(JSON.stringify(payload), {status: 200});
}

export async function add_city(req, env){
	// check sesion
	const session = await SESSION(env.KV, req);
	if(!session)
		return new Response(JSON.stringify({
			success: false,
			code: "UNAUTHORIZED",
			message: "Unauthorized access",
		}), {status: 401});

	const data = await POST(req);
	console.log(data);
	const city = data.city;
 	const latitude = data.latitude;
 	const longitude = data.longitude;
 	await env.DB.prepare(`
     		INSERT INTO tb_location (city, latitude, longitude)
        	VALUES (?, ?, ?)
 	`).bind(city, latitude, longitude).run();
	return new Response(JSON.stringify({
		success: true,
		code: "CHANGES_APPLIED",
		message: "Changes applied successfully",
	}), {status: 200});
}

/*
 * Add/update history content
 *
 * POST Body specs:
 * 	update		: bool (true means add new, flase means update), 
 * 	id		: integer (content id), 
 * 	year		: integer, 
 * 	city		: string, 
 * 	custom_location	: bool (true: use city as location, false: add new city/long/lat to the tb_lcoation), 
 * 	longitude	: int, 
 * 	latitude	: int, 
 * 	title		: string, 
 * 	content		: string
 *
 * */
export async function edit_history(req, env){
	// check sesion
	const session = await SESSION(env.KV, req);
	if(!session)
		return new Response(JSON.stringify({
			success: false,
			code: "UNAUTHORIZED",
			message: "Unauthorized access",
		}), {status: 401});

	// post: id, year, city, custom_location, longitude, latitude, title, content
	const post = await POST(req);

	// query
	// insert into year
	if(!post.year)
		return new Response(JSON.stringify({
			success: false,
			code: "INVALID_YEAR",
			message: "Invalid year",
		}), {status: 400});
	await env.DB.prepare("insert or ignore into tb_year(year) values (?)").bind(post.year).run();

	// if custom location: insert into location(city, latitude, longitude)
/*
	if(post.custom_location === "true"){
		if(!post.city)
			return new Response(JSON.stringify({
				success: false,
				code: "INVALID_CITY",
				message: "Invalid city",
			}), {status: 400});

		if(!post.longitude)
			return new Response(JSON.stringify({
				success: false,
				code: "INVALID_LONGITUDE",
				message: "Invalid longitude",
			}), {status: 400});

		if(!post.latitude)
			return new Response(JSON.stringify({
				success: false,
				code: "INVALID_LATITUDE",
				message: "Invalid latitude",
			}), {status: 400});

		await env.DB.prepare("insert or ignore into tb_location(city, longitude, latitude) values (?,?,?)").bind(post.city, post.longitude, post.latitude).run();
	}
*/
	// mode: add new history
	if(post.update === "false"){
		const query = await env.DB.prepare(`
			insert or ignore into tb_content(
				year_id,
				location_id,
				title,
				content
			)
			values (
				(select id from tb_year where tb_year.year = ?),
				(select id from tb_location where tb_location.city = ?),
				?,
				?
			)
		`).bind(post.year, post.city, post.title, post.content).run();

		if(!query.success)
			return new Response(JSON.stringify({
				success: false,
				code: "ADD_HISTORY_FAILED",
				message: "Failed to add history",
			}), {status: 500});

	}
	// update an already existed history content
	else {
		const query = await env.DB.prepare(`
				update tb_content 
				set 
					year_id = (select id from tb_year where tb_year.year = ?),
					location_id = (select id from tb_location where tb_location.city = ?),
					title = ?,
					content = ?
				where
					id = ?
			`).bind(post.year, post.city, post.title, post.content, post.id).run();

		if(!query.success)
			return new Response(JSON.stringify({
				success: false,
				code: "UPDATE_HISTORY_FAILED",
				message: "Failed to update history",
			}), {status: 500});
	}
	// return success
	return new Response(JSON.stringify({
		success: true,
		code: "CHANGES_APPLIED",
		message: "Changes applied successfully",
	}), {status: 200});

/*
Test Code
await fetch("/api/editor/add-history", {method: "POST", body:JSON.stringify({
    update: "false",
    id: null,
    year: 1944,
    city: "jakarta",
    title: "Title: percobaan 2",
    content: "Coontent: Percoibaan 2",
    custom_location: "false",
    longitude: null,
    latitude:null
}), headers: {"Content-Type":"application/json"}, credentials: "include"})

 * */
}

/*
 *Delete
 * */
export async function delete_history(req, env){
	// check session
	const session = await SESSION(env.KV, req);
	if(!session)
		return new Response(JSON.stringify({
			success: false,
			code: "UNAUTHORIZED",
			message: "Unauthorized access",
		}), {status: 401});

	// post: id
	const get = await GET(req);
	if(!get.id)
		return new Response(JSON.stringify({
			success: false,
			code: "INVALID_ID",
			message: "Invalid id",
		}), {status: 400});

	// query
	const query = await env.DB.prepare("delete from tb_content where id = ?").bind(get.id).run();
	if(!query.success)
		return new Response(JSON.stringify({
			success: false,
			code: "DELETE_FAILED",
			message: "Failed to delete a history",
		}), {status: 500});

	// return success
	return new Response(JSON.stringify({
		success: true,
		code: "DELETE_SUCCESS",
		message: "Delete history successfully",
	}), {status: 200});
}
