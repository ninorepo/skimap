// GLOBALS
let current_year = 0;
const dialog_years_cancel = document.getElementById("dialog-years-cancel");
const dialog_years = document.getElementById("dialog-years");
const choose_year = document.getElementById("choose-year");
const dialog_content = document.getElementById("dialog-content");
const content = document.getElementById("content");
const dialog_content_cancel = document.getElementById("dialog-content-close");


// load years into hud menu
init();

//import Globe from

const globe = Globe()(document.getElementById("map"))
    .globeImageUrl(
        "https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
    )
    .backgroundImageUrl(
        "https://unpkg.com/three-globe/example/img/night-sky.png"
    )
    .pointsData([
        {
            lat: 41.0082,
            lon: 28.9784,
            city: "Constantinople"
        }
    ])
    .pointLat("lat")
    .pointLng("lon")
    .pointLabel("city")
    .pointAltitude(0.3)
    .pointRadius(0.5)
    .onPointClick(point_click_handler);

/*
//DEBUG
const globe = Globe()(document.getElementById("map"))
    .globeImageUrl(null)
    .backgroundColor("#666666")
    .showAtmosphere(false)
    .pointLat("lat")
    .pointLng("lon")
    .pointLabel("city")
    .pointAltitude(0.3)
    .pointRadius(0.5)
    .onPointClick(point_click_handler);
*/

// FUNCTIONS
async function init(){
	//button pilih tahun
	choose_year.addEventListener("click", choose_year_handler);
	dialog_years_cancel.addEventListener("click", () => {dialog_years.close()});
	dialog_content_cancel.addEventListener("click", () => {dialog_content.close()});

	// load years
	const response = await fetch("/api/init");
	if(!response){
		console.log("init(): failed to fetch /api/init");
		return false;
	}
	const data = await response.json();
	if(!response){
		console.log("init(): failed to load json response");
		return false;
	}
	
	data.years.forEach(elem => {
		const button = document.createElement("button");
		button.className = "button-year";
		button.textContent = int_masehi(elem);
		button.addEventListener("click", button_year_handler);
		dialog_years.appendChild(button);
	});
	return true;
}

function choose_year_handler(ev){
	const button = ev.target;
	const title = document.querySelector("#hud h2");
	title.textContent = button.textContent;
	dialog_years.showModal();
}

async function button_year_handler(ev){
	const button = ev.target;
	// load locations
	const response = await fetch("/api/locations?year=" + masehi_int(button.textContent));
	if(!response){
		console.log("button_year_handler(): failed to fetch /api/locations");
		return false;
	}
	const data = await response.json();
	if(!data){
		console.log("failed to load locations json");
		return false;
	}
	// update globe points
	globe.pointsData(data.locations);
	// add event listener to the points
	current_year = masehi_int(button.textContent);
	dialog_years.close();
	return true;
}

async function point_click_handler(pt, ev){
	// fetch contents
	const button = ev.target;
	const response = await fetch("/api/contents?year=" + current_year + "&city=" + pt.city);
	if(!response){
		console.log("button_year_handler(): failed to fetch /api/contents");
		return false;
	}
	const data = await response.json();
	if(!data){
		console.log("failed to load locations json");
		return false;
	}

	// foereach content append wrapper+title+content to #content dialog
	content.innerHTML = "";
	data.contents.forEach((elem) => {
		const html = `
			<div class="container">
				<h2>${elem.title}</h2>
				<p>${elem.content}</p>
			</div>
			`;
		content.insertAdjacentHTML("beforeend", html);
	});
	// open content dialog
	dialog_content.showModal();
}

// HELPERS
function int_masehi(year) {
    if (year <= 0) {
        return `${1 - year} SM`;
    }

    return `${year} M`;
}

function masehi_int(str) {
    str = str.trim().toUpperCase();

    if (str.endsWith("SM")) {
        return 1 - parseInt(str);
    }

    if (str.endsWith("M")) {
        return parseInt(str);
    }

    return NaN;
}

