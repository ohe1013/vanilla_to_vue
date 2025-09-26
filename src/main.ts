import { effect, ref } from "./vue";

document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
  <div>
    <input id="age" data-model="age" />
    <span data-text="age"></span>
    <button id="plus">+</button>
  </div>
`;

const store = { age: ref(20) };

function mountBindings(root: ParentNode = document) {
  // data-text="key" → 텍스트 바인딩
  root.querySelectorAll<HTMLElement>("[data-text]").forEach((el) => {
    const key = el.dataset.text!;
    const r = (store as any)[key];
    effect(() => {
      el.textContent = String(r.value);
    });
  });

  // data-model="key" → 양방향 바인딩
  root
    .querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("[data-model]")
    .forEach((el) => {
      const key = el.dataset.model!;
      const r = (store as any)[key];
      el.addEventListener("input", () => {
        r.value = (el as any).value;
      });
      effect(() => {
        (el as any).value = String(r.value ?? "");
      });
    });
}

mountBindings();

document.querySelector("#plus")!.addEventListener("click", () => {
  store.age.value++;
});
