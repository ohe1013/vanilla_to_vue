document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
  <input v-model="text.value" placeholder="할 일을 입력" />
  <span v-text="text.value"></span>
`;

function setup() {
  const text = ref("");
  return { text };
}

// createApp(App).mount(document.getElementById("app") as HTMLElement);
const REF_DEP = Symbol("ref-dep");
const REF_FLAG = Symbol("ref");
interface Ref<T> {
  readonly [REF_FLAG]: true;
  value: T;
  [REF_DEP]?: Set<Effect>;
}
type Effect = Function;
let activeEffect: Effect | null = null;

function trackRef(r: Ref<any>) {
  if (!activeEffect) return;
  (r[REF_DEP] ??= new Set()).add(activeEffect);
}
function triggerRef(r: Ref<any>) {
  r[REF_DEP]?.forEach((fn) => fn());
}
function effect(fn: Effect) {
  const runner = () => {
    const prev = activeEffect;
    activeEffect = runner;
    try {
      fn();
    } finally {
      activeEffect = prev;
    }
  };
  runner();
  return runner;
}
function ref<T>(initial: T): Ref<T> {
  let v = initial;
  const r: Ref<T> = {
    [REF_FLAG]: true,
    get value() {
      trackRef(r);
      return v;
    },
    set value(n: T) {
      v = n;
      triggerRef(r);
    },
  };
  return r;
}
type Scope = Record<string, any>;
function bindModel(
  el: HTMLInputElement | HTMLTextAreaElement,
  expr: string,
  scope: Scope
) {
  el.addEventListener("input", () => setPath(scope, expr, el.value));
  effect(() => {
    (el as any).value = getPath(scope, expr) ?? "";
  });
}
function bindText(el: HTMLElement, expr: string, scope: Scope) {
  effect(() => {
    const v = getPath(scope, expr);
    el.textContent = v == null ? "" : String(v);
  });
}
function mountBindings(root: ParentNode, scope: Scope) {
  root
    .querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("[v-model]")
    .forEach((el) => {
      bindModel(el, el.getAttribute("v-model")!, scope);
    });
  root.querySelectorAll<HTMLElement>("[v-text]").forEach((el) => {
    bindText(el, el.getAttribute("v-text")!, scope);
  });
}
function setPath(scope: Scope, expr: string, val: any) {
  const keys = expr.split(".");
  const last = keys.pop()!;
  const obj = keys.reduce((acc, k) => (acc as any)[k], scope);
  (obj as any)[last] = val;
}
function getPath(scope: Scope, expr: string): any {
  return expr.split(".").reduce((acc, k) => (acc as any)?.[k], scope);
}

mountBindings(document.getElementById("app")!, setup());
