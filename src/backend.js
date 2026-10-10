import {GET, POST, COOKIE} from "./lib/core.js"

export async function init(req, env){
	// fetch all available years
	const query = await env.DB.prepare("select year from tb_year").all();
	if(!query)
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
	/*
	 {
		success: true,
		code: YEARS_LOADED,
		message: "Years loaded successfully",
		years: [1945, ...]
	 }
	 * */
}

/*
 * Get all  locaitons base on selected year
 */
export async function get_locations(req, env){
	// get year
	const get = await GET(req);
	const year = get.year;
	const era = get.era;

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
				tb_content.year_id = (
					select id from tb_year 
					where tb.year.year = ? and
						tb_year.era = ?
				)
		`).bind(year, era).all();
	if(!query)
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
		era,
		locations: rows.map(row => {
			city: row.city,
			lng: row.longitude, 
			ltt: row.latitude });
	};

	return new Response(JSON.stringify(payload), {status: 200});
	/*
	  {
		success: true,
		code: "LOCATIONS_LOAD",
		message: "Locations loaded successfully"
		year: 1945
		era: "M"
		locations: [
			{
				city: "jakarta"
				lng:,
				ltt:
			},
			{
				city : "mecca",
				lng:,
				ltt:
			}
		]
	  }
	  */
}

/*
 * get content based on selected year and location
 */
export async function get_content(req, env){
	const get = await GET(req);
	// get selected year
	const year = get.year;
	// get selected location
	const city = get.city;
	// fetch content where year = sellected year and location = selected location
	const query = env.DB.prepare("");
	/*
	 {
		success: true,
		code: "CONTENT_LOADED",
		message: "Content loaded usccessfully",
		year: 1945,
		era: "M",
		location: {
			city: "jakarta",
			long:,
			ltt:
		}
		contents: [
			{
				title:,
				text:
			}, ...
		]
	 }
	 * */
}
