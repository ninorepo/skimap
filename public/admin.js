// GLOBALS
let current_page = 1;
const rows_per_page = 30;
const content_container = document.querySelector("#content-list .container");
const add_history = document.getElementById("add-history");
const add_city_button = document.getElementById("add-city-button");
const editor_dialog = document.getElementById("editor-dialog");
const cancel_editor = document.getElementById("cancel-editor");
const city_select = document.querySelector("#editor-form select");
const ai_assistant_button = document.getElementById("ai-assistant-button");

// GLOBALS EDITOR FORM
const form = document.querySelector("#editor-form");
const formId =  form.querySelector('[name="id"]'); 
const formTitle = form.querySelector("#title");
const formYear = form.querySelector("#year");
const formMasehi = form.querySelector("#masehi");
const formSebelumMasehi = form.querySelector("#sebelum-masehi");
const formCity = form.querySelector('[name="city"]');
const formUpdate = form.querySelector('[name="update"]');
const formContent = form.querySelector("#editor");
const formCancel = form.querySelector("#cancel-editor");
const formSubmit = form.querySelector("#submit");
const formEra = form.querySelector('[name="era"]:checked');

// GLOBALS ADD CITY FORM
const formAddCity = document.querySelector("#add-city");
const formAddCityName = formAddCity.querySelector("#city-name");
const formAddCityLatitude = formAddCity.querySelector("#city-latitude");
const formAddCityLongitude = formAddCity.querySelector("#city-longitude");
const formAddCityCancel = formAddCity.querySelector("#cancel-add-city");
const formAddCitySubmit = formAddCity.querySelector("#submit-add-city");

init();

hugerte.init({
  selector: '#editor',
  plugins: 'image',
  toolbar: 'image',

  images_file_types: 'webp',

  file_picker_types: 'image',

  file_picker_callback: (callback, value, meta) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.webp,image/webp';

    input.onchange = () => {
      const file = input.files[0];
      if (!file) return;

      if (file.type !== 'image/webp') {
        alert('Only WebP images are allowed');
        return;
      }

      const reader = new FileReader();

      reader.onload = () => {
        callback(reader.result, {
          alt: file.name
        });
      };

      reader.readAsDataURL(file);
    };

    input.click();
  }
});


// FUNNCTIONS
async function init(){
	// verify whether logged in
	const response_user = await fetch("/api/user/verify");
	if(!response_user){
		console.log("Unauthorized visitor");
		location.href = "/login";
		return false;
	}
	
	// init add city button
	add_city_button.addEventListener("click", () => {
		formAddCity.showModal();
	});

	// init AI Assistant button
	ai_assistant_button.addEventListener("click", async () => {
		await aiAssistantDialog();
	});

	// init cancel add city
	formAddCityCancel.addEventListener("click", () => {
		formAddCity.close();
	});


	// init add history button
	add_history.addEventListener("click", () => {
		const update = document.querySelector("form input[type='hidden']");
		update.value = "false";
		editor_dialog.classList.remove("hide");
	});

	// init add city submit button
	formAddCitySubmit.addEventListener("click", async () => {
    		const data = {
        		city: formAddCityName.value,
        		latitude: Number(formAddCityLatitude.value),
        		longitude: Number(formAddCityLongitude.value)
    		};

   		 const response = await fetch("/api/editor/add-city", {
        		method: "POST",
        		headers: {
            			"Content-Type": "application/json"
        		},
        		body: JSON.stringify(data)
    		});

    		const result = await response.json();
    		console.log(result);
		location.reload();
	});


	// init cancel editor button
	cancel_editor.addEventListener("click", () => {
		editor_dialog.classList.add("hide");
		formId.value = "";
		formTitle.value = "";
		formYear.value = "";
		formMasehi.checked = "";
		hugerte.get("editor").setContent("");
		formCity.value = "";
		formUpdate.value = "";
	});
	
	// init locaitons selector inside edit form
	const response_loc = await fetch("/api/editor/locations");
	if(!response_loc){
		console.log("No locations found");
		return false;
	}
	city_select.innerHTML = "";
	const response_loc_data = await response_loc.json();
	const cities = response_loc_data.cities;
	console.log("CITIES: ", cities);
	cities.forEach( (city) => {
		html = `<option value="${city}">${city}</option>`;
		city_select.insertAdjacentHTML("beforeend", html);
	});

	// init editor submit
	form.addEventListener("submit",async (ev) => {
		ev.preventDefault();
		const target = ev.target;
		const fdata = new FormData(target);
		const era = fdata.get("era");
		const year = (era === "masehi") ? fdata.get("year") : ((fdata.get("year") - 1)*(-1)); 
		const payload = {
 			update	: fdata.get("update"), 
 			id	: fdata.get("id"), 
 			year, 
 			city	: fdata.get("city"), 
 			title	: fdata.get("title"), 
			content	: hugerte.get("editor").getContent()
		};

		const response = await fetch("/api/editor/edit-history", {
			method: "POST",
			headers: {"Content-Type": "application/json"},
			body: JSON.stringify(payload)
		});

		location.reload();
	});
	
	// init content list
	const response_editor = await fetch("api/editor/list-histories?page=" + 1 +"&rows=" + rows_per_page);
	if(!response_editor){
		console.log("No histories found");
		return false;
	}
	const data = await response_editor.json();
	// get histories and draw into table
	const histories = data.histories;
	draw_table(histories);

	// pagination
	pagination("#pagination", 20, current_page, rows_per_page);
	return true;
}

async function draw_table(histories){
	content_container.innerHTML = "";
	// table header
	const header_html = `<div class="row">
			<span>Year</span>
			<span>City</span>
			<span>Title</span>
			<span>Modified</span>
			<span>Edit</span>
			<span>Delete</span>
		</div>`;
	content_container.insertAdjacentHTML("beforeend", header_html);

	histories.forEach( elem => {
		const wrapper = document.createElement("div");
		const year = document.createElement("span");
		const city = document.createElement("span");
		const title = document.createElement("span");
		//const content = document.createElement("span");
		const modified_time = document.createElement("span");
		const edit = document.createElement("button");
		const delete_button = document.createElement("button");
		// table
		wrapper.className = "row";

		year.textContent = (elem.year > 0) ? (elem.year + " M") : (Math.abs(elem.year) + 1) + " SM";
		city.textContent = elem.city;
		title.textContent = elem.title;
		//content.textContent = elem.content.substring(0, 30) + "...";
		modified_time.textContent = "modified time";
		edit.textContent = "edit";
		edit.classList.add("btn", "btn-secondary");
		edit.dataset.historyId = elem.id;
		delete_button.textContent = "delete";
		delete_button.classList.add("btn", "btn-accent");
		delete_button.dataset.historyId = elem.id;

		edit.addEventListener("click", async (ev) => {
			const target = ev.target;
			const editor_dialog = document.getElementById("editor-dialog");
			const update = document.querySelector("#editor-form input[type='hidden']");
			update.value = "true";

			// load the content/history
			const response = await fetch("/api/editor/get-history?id=" + target.dataset.historyId);
			if(!response){
				console.log("Cannot load history for editing");
				return;
			}
			const data = await response.json();
			const history = data.history;

			// init editor
			formId.value = history.id;
			formTitle.value = history.title;
			formYear.value = (history.year > 0) ? history.year : (Math.abs(history.year)+1);
			formMasehi.checked = (history.year > 0);
			hugerte.get("editor").setContent(history.content);
			formCity.value = history.city;
			formUpdate.value = "true";

			editor_dialog.classList.remove("hide");
		});

		delete_button.addEventListener("click", async (ev) => {
			const target = ev.target;
			const history_id = target.dataset.historyId;
			let confirmed = await confirm_modal("Are you sure to delete?", "This will be permanent, cannot be undone");
			if(confirmed){
				await fetch("/api/editor/delete-history?id=" + history_id);
				location.reload();
			}
			return;
		});

		wrapper.appendChild(year);
		wrapper.appendChild(city);
		wrapper.appendChild(title);
		//wrapper.appendChild(content);
		wrapper.appendChild(modified_time);
		wrapper.appendChild(edit);
		wrapper.appendChild(delete_button);
		
		content_container.appendChild(wrapper);
	});

}

function pagination(selector, pages, page, num){
	const elem = document.querySelector(selector);
	elem.innerHTML = "";
	// create pagination elements
	for(let i=1 ; i<=pages; i++){
		const page_elem = document.createElement("a");
		page_elem.textContent = i;
		page_elem.href = "/api/editor/list-histories?page=" + i +"&rows=" + num;
		page_elem.addEventListener("click", pagination_handler);
		elem.appendChild(page_elem);
	}
}

async function pagination_handler(ev){
	ev.preventDefault();
	const target = ev.target;
	// fetch list
	const response = await fetch(target.href); 
	// update list
	if(!response){
		console.log("No histories found");
		return false;
	}
	const data = await response.json();
	const histories = data.histories;
	// get list of the content
	draw_table(histories);

	return true;
}

async function confirm_modal(question, description){
	return new Promise(resolve => {
		const confirm_modal = document.getElementById("confirm-modal");
		const h4 = document.querySelector("#confirm-modal h4");
		const p = document.querySelector("#confirm-modal p");
		const yes = document.getElementById("confirm-yes");
		const no = document.getElementById("confirm-no");

		h4.textContent = question;
		p.textContent = description;

		yes.addEventListener("click", () => {
			confirm_modal.close();
			resolve(true);
		});

		no.addEventListener("click", () => {
			confirm_modal.close();
			resolve(false);
		});

		confirm_modal.showModal();
	});
}
