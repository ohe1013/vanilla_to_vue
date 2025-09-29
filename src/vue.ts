// mini-vue-dom.ts
// === 0) 아주 작은 반응성 코어 ===
type Effect = () => void;
let activeEffect: Effect | null = null;
const ITERATE_KEY = Symbol("iterate");

export function effect(fn: Effect) {
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
const bucket = new WeakMap<object, Map<PropertyKey, Set<Effect>>>();
const REF_FLAG = Symbol("ref");
const REF_DEP = Symbol("ref-dep");

export interface Ref<T> {
  readonly [REF_FLAG]: true;
  value: T;
  [REF_DEP]?: Set<Effect>;
}

export const isRef = (x: any): x is Ref<any> => !!x && x[REF_FLAG] === true;
export const unref = <T>(x: T | Ref<T>): T => (isRef(x) ? x.value : x);

function trackRef(r: Ref<any>) {
  if (!activeEffect) return;
  (r[REF_DEP] ??= new Set()).add(activeEffect);
}
function triggerRef(r: Ref<any>) {
  r[REF_DEP]?.forEach((fn) => fn());
}

const isObj = (v: any): v is object => typeof v === "object" && v !== null;
function toReactive<T>(v: T): T {
  return (isObj(v) ? reactive(v as any) : v) as T;
}

export function ref<T>(initial: T): Ref<T> {
  let v = toReactive(initial);
  const r: Ref<T> = {
    [REF_FLAG]: true,
    get value() {
      trackRef(r);
      return v;
    },
    set value(n: T) {
      if (Object.is(v, n)) return;
      v = toReactive(n);
      triggerRef(r);
    },
  };
  return r;
}

// (옵션) 얕은 ref
export function shallowRef<T>(initial: T): Ref<T> {
  let v = initial;
  const r: Ref<T> = {
    [REF_FLAG]: true,
    get value() {
      trackRef(r);
      return v;
    },
    set value(n: T) {
      if (Object.is(v, n)) return;
      v = n;
      triggerRef(r);
    },
  };
  return r;
}
function track(t: object, k: PropertyKey) {
  if (!activeEffect) return;
  let m = bucket.get(t);
  if (!m) bucket.set(t, (m = new Map()));
  let s = m.get(k);
  if (!s) m.set(k, (s = new Set()));
  s.add(activeEffect);
}
function trigger(t: object, k: PropertyKey) {
  bucket
    .get(t)
    ?.get(k)
    ?.forEach((fn) => fn());
}
export function reactive<T extends object>(raw: T): T {
  if (!isObj(raw)) return raw;

  return new Proxy(raw, {
    get(target, key, receiver) {
      const res = Reflect.get(target, key, receiver);
      track(target, key);

      // 자동 언랩: 배열 제외(배열 요소는 언랩하지 않음, Vue 규칙)
      if (!Array.isArray(target) && isRef(res)) {
        trackRef(res); // ref 자체도 추적
        return res.value;
      }
      return isObj(res) ? reactive(res as any) : res;
    },
    set(target, key, value, receiver) {
      const old = (target as any)[key];

      // 기존 값이 ref이고(배열 제외) 새 값이 ref가 아니면 .value에 대입
      if (!Array.isArray(target) && isRef(old) && !isRef(value)) {
        (old as Ref<any>).value = value; // 내부에서 triggerRef 실행됨
        return true;
      }

      const changed = !Object.is(old, value);
      const ok = Reflect.set(target, key, value, receiver);
      if (changed) trigger(target, key);
      return ok;
    },
    deleteProperty(t, k) {
      const hadKey = Object.prototype.hasOwnProperty.call(t, k);
      const ok = Reflect.deleteProperty(t, k);
      if (hadKey) {
        trigger(t, k);
        trigger(t, ITERATE_KEY);
      }
      return ok;
    },
    defineProperty(t, k, desc) {
      const ok = Reflect.defineProperty(t, k, desc);
      trigger(t, k); // 배열 메서드가 내부적으로 define할 때 대비
      return ok;
    },
    ownKeys(t) {
      track(t, ITERATE_KEY); // for..of / v-each 등 반복 의존성
      return Reflect.ownKeys(t);
    },
  });
}
// === 1) 경로 접근 헬퍼 (a.b.c) ===
type Scope = Record<string, any>;
function getPath(scope: Scope, path: string): any {
  return path.split(".").reduce((acc, k) => {
    return (acc as any)?.[k];
  }, scope);
}
function setPath(scope: Scope, path: string, val: any) {
  const keys = path.split(".");
  const last = keys.pop()!;
  const obj = keys.reduce((acc, k) => (acc as any)[k], scope);
  (obj as any)[last] = val;
}

// === 2) 자식 스코프 (each용): locals 우선 → 없으면 parent로 위임 ===
function withScope(parent: Scope, locals: Scope): Scope {
  return new Proxy(locals, {
    get(t, k) {
      return k in t ? (t as any)[k] : (parent as any)[k];
    },
    set(t, k, v) {
      if (k in t) (t as any)[k] = v;
      else (parent as any)[k] = v;
      return true;
    },
  });
}

// === 3) 바인딩 지시자들 ===
function bindText(el: HTMLElement, expr: string, scope: Scope) {
  effect(() => {
    const v = getPath(scope, expr);
    el.textContent = v == null ? "" : String(v);
  });
}

function bindModel(
  el: HTMLInputElement | HTMLTextAreaElement,
  expr: string,
  scope: Scope
) {
  const key = `model::${expr}`;
  let set = __BOUND.get(el);
  if (!set) {
    set = new Set();
    __BOUND.set(el, set);
  }
  if (!set.has(key)) {
    set.add(key);
    el.addEventListener("input", () => setPath(scope, expr, (el as any).value));
  }

  effect(() => {
    (el as any).value = getPath(scope, expr) ?? "";
  });
}

const __BOUND = new WeakMap<EventTarget, Set<string>>();

function bindOn(el: HTMLElement, event: string, fnPath: string, scope: Scope) {
  const key = `${event}::${fnPath}`;

  // --- 중복 바인딩 방지 ---
  let set = __BOUND.get(el);
  if (!set) {
    set = new Set();
    __BOUND.set(el, set);
  }
  if (set.has(key)) return; // 이미 붙어있으면 스킵
  set.add(key);
  // -----------------------

  el.addEventListener(event, (ev) => {
    const fn = getPath(scope, fnPath);
    if (typeof fn === "function") {
      fn.call(scope, (scope as any).$item, (scope as any).$index, ev);
    }
  });
}
// === 4) v-each: <template v-each="todo in todos"> ===
function parseEach(expr: string) {
  const m = expr.trim().match(/^(\w+)\s+in\s+(.+)$/);
  if (!m) throw new Error(`Invalid v-each: ${expr}`);
  return { alias: m[1], listPath: m[2] };
}
function evalExpr(expr: string, scope: Record<string, any>) {
  try {
    return Function("scope", `with(scope){ return (${expr}); }`)(scope);
  } catch (e) {
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
function bindEach(tpl: HTMLTemplateElement, expr: string, parentScope: any) {
  const { alias, listPath } = parseEach(expr);
  const container = tpl.parentElement!;
  effect(() => {
    const list: any[] = getPath(parentScope, listPath) ?? [];
    const len = list.length; // 길이 의존성
    for (let i = 0; i < len; i++) {
      // 인덱스 의존성
      void list[i];
    }
    const frag = document.createDocumentFragment();
    for (let i = 0; i < len; i++) {
      const node = tpl.content.cloneNode(true) as DocumentFragment;
      const child = withScope(parentScope, {
        [alias]: list[i],
        $item: list[i],
        $index: i,
      });
      mountBindings(node, child);
      frag.appendChild(node);
    }
    container.replaceChildren(frag);
  });
}
// === 5) 스캐너: 선언 바인딩 장착 ===
export function mountBindings(root: ParentNode, scope: any) {
  // (A) 구조 지시자 먼저: v-each, v-if
  root.querySelectorAll("template[v-each]").forEach((tpl) => {
    bindEach(
      tpl as HTMLTemplateElement,
      (tpl as Element).getAttribute("v-each")!,
      scope
    );
  });
  root.querySelectorAll("template[v-if]").forEach((tpl) => {
    bindIf(
      tpl as HTMLTemplateElement,
      (tpl as Element).getAttribute("v-if")!,
      scope
    );
  });

  // (B) 나머지 일반 지시자들
  root.querySelectorAll<HTMLElement>("[v-text]").forEach((el) => {
    bindText(el, el.getAttribute("v-text")!, scope);
  });
  root
    .querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("[v-model]")
    .forEach((el) => {
      bindModel(el, el.getAttribute("v-model")!, scope);
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

export function proxyRefs<T extends object>(obj: T): T {
  return new Proxy(obj, {
    get(t, k, r) {
      const v = Reflect.get(t, k, r);
      return isRef(v) ? v.value : v;
    },
    set(t, k, v, r) {
      const old = Reflect.get(t, k, r);

      if (isRef(old) && !isRef(v)) {
        old.value = v;
        return true;
      }
      return Reflect.set(t, k, v, r);
    },
  });
}

type MiniComponent = {
  setup: () => Record<string, any>;
};

export function createApp(Component: MiniComponent) {
  return {
    mount(root: Element | DocumentFragment) {
      const scope = proxyRefs(Component.setup());
      mountBindings(root as ParentNode, scope);
      return scope;
    },
  };
}
