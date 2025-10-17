document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
  <input v-model="text.value" placeholder="할 일을 입력" />
  <span v-text="text.value"></span>
  <button v-on:click="edit">텍스트 초기화</button>
`;

function setup() {
  const text = ref("");
  const edit = () => {
    text.value = "";
  };
  return { text, edit };
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
function bindOn(el: HTMLElement, event: string, fnPath: string, scope: Scope) {
  el.addEventListener(event, (ev) => {
    const fn = getPath(scope, fnPath);
    if (typeof fn === "function") {
      fn.call(scope, (scope as any).$item, (scope as any).$index, ev);
    }
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
  root
    .querySelectorAll<HTMLElement>(
      "[v-on\\:click],[v-on\\:change],[v-on\\:input]"
    )
    .forEach((el) => {
      for (const a of Array.from(el.attributes))
        if (a.name.startsWith("v-on:"))
          bindOn(el, a.name.slice(5), a.value, scope);
    });
}

function evalExpr(expr: string, scope: Record<string, any>) {
  try {
    const keys = Object.keys(scope);
    const vals = keys.map((k) => scope[k]);
    // strict에서도 OK
    const fn = new Function(...keys, `return (${expr});`);
    return fn(...vals);
  } catch {
    return undefined;
  }
}
function bindIf(tpl: HTMLTemplateElement, expr: string, scope: any) {
  // 템플릿 자리에 앵커 코멘트를 남겨두고 템플릿은 제거
  const anchor = document.createComment("v-if");
  const parent = tpl.parentNode!;
  parent.insertBefore(anchor, tpl);
  tpl.remove();

  let mounted: Node[] = []; // 현재 화면에 붙은 노드들

  effect(() => {
    const show = !!evalExpr(expr, scope);
    if (mounted.length) {
      mounted.forEach((n) => n.parentNode && n.parentNode.removeChild(n));
      mounted = [];
    }

    if (show) {
      // 템플릿 복제 → 내부 선언 바인딩 재귀 적용 → 앵커 뒤에 삽입
      const frag = tpl.content.cloneNode(true) as DocumentFragment;
      mountBindings(frag, scope); // 내부 v-* 재귀 바인딩
      const nodes = Array.from(frag.childNodes);
      anchor.parentNode!.insertBefore(frag, anchor.nextSibling);
      mounted = nodes;
    }
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
