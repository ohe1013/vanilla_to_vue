import { createApp, reactive, ref } from "./vue";

document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
  <input v-model="draft" placeholder="할 일을 입력" />
  <input v-model="draft" placeholder="할 일을 입력" />
  <input v-model="draft" placeholder="할 일을 입력" />
  <button v-on:click="add">추가</button>


  <template v-if="todos.length === 0">
    <p>할 일이 없어요!</p>
  </template>

  <ul>
    <template v-each="todo in todos">
      <li>
        <template v-if="!todo.isEditing">
          <span v-text="todo.text"></span>
          <button v-on:click="toggleEdit">✎</button>
          <button v-on:click="remove">−</button>
        </template>
        <template v-if="todo.isEditing">
          <input v-model="todo.text" />
          <button v-on:click="toggleEdit">저장</button>
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

const App = {
  setup() {
    const draft = ref("");
    const todos = reactive<Todo[]>([]);

    function add() {
      const v = draft.value.trim();
      if (!v) return;
      todos.push({ id: genId(), text: v, isEditing: false });
      draft.value = "";
    }
    function remove(item: Todo) {
      const i = todos.findIndex((todo) => todo.id === item.id);
      if (i >= 0) todos.splice(i, 1);
    }
    function toggleEdit(item: Todo) {
      item.isEditing = !item.isEditing;
    }

    return { draft, todos, add, remove, toggleEdit };
  },
};

createApp(App).mount(document.getElementById("app") as HTMLElement);
