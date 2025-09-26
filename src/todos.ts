const todoInputId = "todo-input";
const todoUlId = "todo-ul";
const addButtonId = "add-button";
document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
  <ul id="${todoUlId}"></ul>
  <input id="${todoInputId}" />
  <button id="${addButtonId}">+</button>
`;
type Todo = { id: string; text: string; isEditing: boolean };
let todos: Todo[] = [];

const $ul = document.getElementById("todo-ul")!;
const $input = document.getElementById("todo-input") as HTMLInputElement;
const $add = document.getElementById("add-button")!;

const genId = (() => {
  let n = 0;
  return () => `${Date.now()}-${n++}`;
})();

function render(list: Todo[]) {
  const frag = document.createDocumentFragment();
  for (const t of list) {
    frag.append(createTodoLI(t));
  }
  $ul.replaceChildren(frag);
}

function createTodoLI(t: Todo) {
  const li = document.createElement("li");
  li.dataset.id = t.id;

  if (t.isEditing) {
    const input = document.createElement("input");
    input.value = t.text;
    input.name = "edit";
    const save = document.createElement("button");
    save.textContent = "✔";
    save.dataset.action = "toggleEdit";

    const remove = document.createElement("button");
    remove.textContent = "-";
    remove.dataset.action = "remove";

    li.append(input, save, remove);
  } else {
    const span = document.createElement("span");
    span.textContent = t.text;
    const edit = document.createElement("button");
    edit.textContent = "*";
    edit.dataset.action = "toggleEdit";

    const remove = document.createElement("button");
    remove.textContent = "-";
    remove.dataset.action = "remove";

    li.append(span, edit, remove);
  }
  return li;
}

// ===== actions
function addTodo(text: string) {
  const v = text.trim();
  if (!v) return;
  todos = [...todos, { id: genId(), text: v, isEditing: false }];
  render(todos);
}
function removeTodo(id: string) {
  todos = todos.filter((t) => t.id !== id);
  render(todos);
}
function toggleEdit(id: string) {
  todos = todos.map((t) =>
    t.id === id ? { ...t, isEditing: !t.isEditing } : t
  );
  render(todos);
}
function updateText(id: string, text: string) {
  todos = todos.map((t) => (t.id === id ? { ...t, text } : t));
}

// ===== event delegation
$ul.addEventListener("click", (e) => {
  const btn = e.target as HTMLElement;
  const action = btn.dataset.action;
  if (!action) return;
  const li = btn.closest("li")!;
  const id = li.dataset.id!;
  if (action === "remove") removeTodo(id);
  if (action === "toggleEdit") {
    if (li.querySelector('input[name="edit"]')) {
      // 수정중이면 저장도 함께
      const input = li.querySelector('input[name="edit"]') as HTMLInputElement;
      updateText(id, input.value);
    }
    toggleEdit(id);
  }
});

$input.addEventListener("keydown", (e) => {
  if (e.isComposing) return;
  if (e.key === "Enter") {
    addTodo($input.value);
    $input.value = "";
  }
});
$add.addEventListener("click", () => {
  addTodo($input.value);
  $input.value = "";
});

// 첫 렌더
render(todos);
