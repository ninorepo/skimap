function quiz(container, data) {
  let index = 0;
  let score = 0;
  let answers = [];

  function render() {
    if (index >= data.length) {
      container.innerHTML = `
        <h3>Assessment Complete</h3>
        <p>Score: ${score} / ${data.length}</p>
        <p>${Math.round(score / data.length * 100)}%</p>
        <button id="quiz-restart">Restart</button>
      `;

      container.querySelector("#quiz-restart").onclick = () => {
        index = 0;
        score = 0;
        answers = [];
        render();
      };

      return;
    }

    const q = data[index];

    container.innerHTML = `
      <p>${index + 1} / ${data.length}</p>
      <h3>${q.question}</h3>

      <div>
        ${q.options.map((option, i) => `
          <label style="display:block; margin:8px 0">
            <input type="radio" name="quiz-answer" value="${i}">
            ${option}
          </label>
        `).join("")}
      </div>

      <button id="quiz-next">
        ${index === data.length - 1 ? "Finish" : "Next"}
      </button>
    `;

    container.querySelector("#quiz-next").onclick = () => {
      const selected = container.querySelector(
        'input[name="quiz-answer"]:checked'
      );

      if (!selected) {
        alert("Please select an answer.");
        return;
      }

      const answer = Number(selected.value);
      answers[index] = answer;

      if (answer === q.correct) score++;

      index++;
      render();
    };
  }

  container.innerHTML = "";
  render();
}
