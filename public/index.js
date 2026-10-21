// GLOBALS
const UI = { // ui start
swiper_button:  document.getElementById("swiper-button"),
swiper_section: document.getElementById("swiper"),
swiper_container: document.querySelector("#swiper .container")
,


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
		dialog.scrollTop = 0; // force dialog scroll viewport to show content title first, not the center of trhe content
		close.onclick = () =>
		{
			dialog.close();
			resolve(true);
		};
	});
},

swiper: function (container, data, globe)
{
	container.innerHTML = "";	
	data.forEach( elem => {
		const card = document.createElement("div");
		card.className = "card";
		const html = `
				<p class="eyebrow">${elem.year}⸱${elem.city}</p>
				<h2>${elem.title}</h2>
				<p><span>${elem.categories.join("</span><span>")}</span></p>
				<p class="label">DAMPAK</p> 
					<p>${elem.impact}</p>			
				<p class="label">TOKOH</p>
					<p>${elem.figures.join("⸱")}</p>
				<p class="label">BUKTI</p> 
					<p>${elem.evidences.join("⸱")}</p>
		`;
		card.innerHTML = html;
		card.onclick = () => {
			globe.pointOfView({
				lat: elem.latitude,
				lng: elem.longitude,
				altitude: 0.5
			}, 1000);
		};
		container.appendChild(card);
	});
},

init_swiper_button: function () {
	UI.swiper_button.addEventListener("click", (e) => {
		UI.swiper_button.classList.toggle("swiper-button-down");
		UI.swiper_section.classList.toggle("swiper-hide");
	});
},

init_swiper: function (){
		// horizontall scroll using mousewheel
		UI.swiper_container.addEventListener("wheel", e => {
			e.preventDefault();
			UI.swiper_container.scrollLeft += e.deltaY;
		}, {passive: false});

		// snap when using touch
		UI.swiper_container.addEventListener("touchend", e => {
			const card = e.target.closest(".card");
			card.scrollIntoView({
				behaviour: "smooth",
				block: "nearest",
				inline: "center"
			});
		});
}
}; // ui end

UI.init_swiper_button();
UI.init_swiper();

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
	UI.swiper_section.classList.add("swiper-hide");
	UI.swiper_button.classList.add("swiper-button-down");
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
			if(data.length === 0)
				return;
			// clean markers to pervent redundant
			markers.clear();
			// reload data and auto focus
			globe.htmlElementsData(data).pointOfView({
				lat: data[0].latitude,
				lng: data[0].longitude,
				altitude: 1.5
			},
			1000);
		        
			UI.swiper_button.classList.toggle("swiper-button-down");
			UI.swiper_section.classList.toggle("swiper-hide");
			const swiper_container = document.querySelector("#swiper .container");
			UI.swiper(swiper_container, data, globe);
		});
	});
}

