import { createApp, reactive, ref } from "./vue";

document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
  <input data-model="draft" placeholder="할 일을 입력" />
  <button data-on:click="add">추가</button>

  <!-- (A) 전역 조건 -->
  <template data-if="todos.length === 0">
    <p>할 일이 없어요 ✨</p>
  </template>

  <ul>
    <template data-each="todo in todos">
      <li>
        <!-- (B) 행 단위 조건 -->
        <template data-if="!todo.isEditing">
          <span data-text="todo.text"></span>
          <button data-on:click="toggleEdit">✎</button>
          <button data-on:click="remove">−</button>
        </template>
        <template data-if="todo.isEditing">
          <input data-model="todo.text" />
          <button data-on:click="toggleEdit">저장</button>
        </template>
      </li>
    </template>
  </ul>
`;

type Todo = { id: string; text: string; isEditing: boolean };
const genId = (() => {
  let n = 0;
  return () => `${Date.now()}-${n++}`;
})();

export const App = {
  setup() {
    const draft = ref("");
    const todos = reactive<Todo[]>([]); // 배열은 reactive

    function add() {
      const v = draft.value.trim();
      if (!v) return;
      todos.push({ id: genId(), text: v, isEditing: false });
      draft.value = "";
    }
    function remove(item: Todo) {
      const i = todos.indexOf(item);
      if (i >= 0) todos.splice(i, 1);
    }
    function toggleEdit(item: Todo) {
      item.isEditing = !item.isEditing;
    }

    return { draft, todos, add, remove, toggleEdit };
  },
};

createApp(App).mount(document.getElementById("app") as HTMLElement);
