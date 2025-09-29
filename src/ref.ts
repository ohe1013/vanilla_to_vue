import { createApp } from "./vue";

document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
  <input v-model="text" placeholder="할 일을 입력" />
  <span v-text="text"></span>
`;

const App = {
  setup() {
    const text = ref("");
    return { text };
  },
};

createApp(App).mount(document.getElementById("app") as HTMLElement);

type Ref<T> = {
  value: T;
};
function ref<T>(initial: T): Ref<T> {
  let v = initial;
  const r: Ref<T> = {
    get value() {
      //트래킹할 부분들
      return v;
    },
    set value(n: T) {
      v = n;
      //트리거할 부분들 실행
    },
  };
  return r;
}
