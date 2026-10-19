// GLOBALS
const UI = { // ui start

loading: async function (elem, func)
{
	return new Promise(async (resolve) =>
	{
		elem.classList.add("loading");
		await func();
		elem.classList.remove("loading");
		resolve(true);
	});
},

read_more: function (title, content, quiz_data)
{
	return new Promise(resolve =>
	{
		const dialog = document.getElementById("read-more");
		const h1 = document.querySelector("#read-more h1");
		const div = document.querySelector("#read-more .content");
		const close = document.querySelector("#read-more button");
		const quiz_container = document.querySelector(".quiz");

		h1.textContent = title;
		div.innerHTML = content;
		quiz(quiz_container, quiz_data);
		dialog.showModal();
		close.onclick = () =>
		{
			dialog.close();
			resolve(true);
		};
	});
}

}; // ui end

let gpt_response = [];
const markers = new Map();
const globe = Globe();
const world = globe(document.getElementById("map")).globeImageUrl("https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg").backgroundImageUrl("https://unpkg.com/three-globe/example/img/night-sky.png")
	// Draw city markers
	.htmlLat(data => data.latitude).htmlLng(data => data.longitude).htmlElement(data =>
	{
		const id = data.city;
		let marker = markers.get(id);
		if (!marker)
		{
			const element = document.createElement("div");
			element.id = "marker_id_" + id;
			element.className = "marker";
			element.innerHTML = `
                <div class="marker-events"></div>
                <div class="marker-pin"><p>&#128205;</p></div>
            `;
			marker = {
				latitude: data.latitude,
				longitude: data.longitude,
				element
			};
			markers.set(id, marker);
		}
		// Add the historical event
		const event = document.createElement("div");
		event.innerHTML = `
            <p>
                <b>
                    <span class="marker-year">${data.year} - </span>
                    <span class="marker-city">${data.city}</span>
                </b>
            </p>
            <p class="marker-title">${data.title}</p>
        `;
		event.addEventListener("click", async (e) =>
		{
			e.stopPropagation();
			console.log("click: ", e);
			await UI.read_more(data.title, data.content, data.quiz);
		});
		marker.element.querySelector(".marker-events").appendChild(event);
		updateArcs();
		return marker.element;
	})
	// Draw directional arcs between consecutive cities
	.arcsData([]).arcStartLat(d => d.startLat).arcStartLng(d => d.startLng).arcEndLat(d => d.endLat).arcEndLng(d => d.endLng).arcColor(() => "#ff5722").arcStroke(0.1).arcDashLength(0.2).arcDashGap(0.05).arcDashAnimateTime(2000);
// Build arcs using the insertion order of the Map
function updateArcs()
{
	const locations = Array.from(markers.values());
	const arcs = [];
	for (let i = 0; i < locations.length - 1; i++)
	{
		arcs.push(
		{
			startLat: locations[i].latitude,
			startLng: locations[i].longitude,
			endLat: locations[i + 1].latitude,
			endLng: locations[i + 1].longitude
		});
	}
	world.arcsData(arcs);
}
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
init();
init_prompt(globe);
// FUNCTIONS
async function init()
{
	return true;
}

function init_prompt(globe)
{
	document.getElementById("ask").addEventListener("click", async ev =>
	{
		const prompt = document.getElementById("prompt-input").value;
		if (!prompt.trim()) return;
		const target = ev.target;
		await UI.loading(target, async () =>
		{
			const response = await fetch("/api/assistant/ask",
			{
				method: "POST",
				headers:
				{
					"Content-Type": "application/json"
				},
				body: JSON.stringify(
				{
					prompt
				})
			});
			if (!response.ok)
			{
				console.error("Request failed:", response.status);
				return;
			}
			const data = await response.json();
			gpt_response = structuredClone(data);
			console.log("prompt events: ", data);
			// clean markers to pervent redundant
			markers.clear();
			// reload data and auto focus
			globe.htmlElementsData(data).pointOfView({
				lat: gpt_response[0].latitude,
				lng: gpt_response[0].longitude,
				altitude: 1.5
			},
			1000);
			console.log("markers :", markers);
		});
	});
}
async function point_click_handler(pt, ev)
{
	// fetch contents
	const button = ev.target;
	const response = await fetch("/api/contents?year=" + current_year + "&city=" + pt.city);
	if (!response)
	{
		console.log("button_year_handler(): failed to fetch /api/contents");
		return false;
	}
	const data = await response.json();
	if (!data)
	{
		console.log("failed to load locations json");
		return false;
	}
	// foereach content append wrapper+title+content to #content dialog
	content.innerHTML = "";
	data.contents.forEach((elem) =>
	{
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
