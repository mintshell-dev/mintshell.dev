/**
 * Trang tìm kiếm tự dựng trên Pagefind JS API (ADR 0010): chỉ tải `/pagefind/...` cùng origin,
 * render bằng DOM API (không innerHTML), không `style=`.
 */

/** Phần Pagefind API dùng tới (pagefind.js sinh lúc build, không có kiểu khi typecheck). */
interface PagefindResultData {
  url: string;
  excerpt: string;
  meta: { title?: string };
}

interface Pagefind {
  init(): Promise<void>;
  debouncedSearch(
    term: string,
    options?: object,
    timeout?: number,
  ): Promise<{ results: { data(): Promise<PagefindResultData> }[] } | null>;
}

/** Đường dẫn bundle Pagefind; để trong biến để Vite không cố resolve lúc build. */
const PAGEFIND_PATH = '/pagefind/pagefind.js';
const MAX_RESULTS = 10;
const DEBOUNCE_MS = 200;

const ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&#x27;': "'",
};

export interface ExcerptPart {
  text: string;
  mark: boolean;
}

/**
 * Tách excerpt Pagefind (văn bản đã escape + thẻ `<mark>`) thành đoạn chữ thuần. Chỉ nhận đúng
 * `<mark>`/`</mark>`; mọi thứ khác (kể cả thẻ lạ) giữ nguyên dạng chữ, sau đó gán bằng textContent.
 */
export function excerptParts(excerpt: string): ExcerptPart[] {
  const parts: ExcerptPart[] = [];
  let mark = false;
  for (const chunk of excerpt.split(/(<mark>|<\/mark>)/)) {
    if (chunk === '<mark>') mark = true;
    else if (chunk === '</mark>') mark = false;
    else if (chunk) {
      parts.push({
        text: chunk.replace(/&(?:amp|lt|gt|quot|#39|#x27);/g, (e) => ENTITIES[e] ?? e),
        mark,
      });
    }
  }
  return parts;
}

/**
 * URL kết quả an toàn để gán vào href: chỉ đường dẫn cùng origin (`/x`, không `//host`, không `\`),
 * bỏ đuôi `.html` (build.format: 'file', ADR 0007). Không hợp lệ → undefined (bỏ kết quả).
 */
export function resultHref(url: string): string | undefined {
  if (!/^\/(?![/\\])/.test(url) || /[\\\s]/.test(url)) return undefined;
  return url.replace(/\.html(?=$|[?#])/, '');
}

function renderResult(data: PagefindResultData): HTMLLIElement | undefined {
  const href = resultHref(data.url);
  if (!href) return undefined;
  const li = document.createElement('li');
  const a = document.createElement('a');
  a.href = href;
  a.textContent = data.meta.title ?? href;
  const p = document.createElement('p');
  for (const part of excerptParts(data.excerpt)) {
    if (part.mark) {
      const mark = document.createElement('mark');
      mark.textContent = part.text;
      p.append(mark);
    } else {
      p.append(part.text);
    }
  }
  li.append(a, p);
  return li;
}

export async function initSearch(): Promise<void> {
  const root = document.querySelector<HTMLElement>('[data-search]');
  const input = root?.querySelector<HTMLInputElement>('input[type="search"]');
  const status = root?.querySelector<HTMLElement>('[data-search-status]');
  const list = root?.querySelector<HTMLOListElement>('[data-search-results]');
  if (!root || !input || !status || !list) return;
  const labels = root.dataset;

  let pagefind: Pagefind;
  try {
    pagefind = (await import(/* @vite-ignore */ PAGEFIND_PATH)) as Pagefind;
    await pagefind.init();
  } catch {
    // Chưa có chỉ mục (astro dev) hoặc tải lỗi: báo rõ, giữ ô nhập ở trạng thái tắt.
    status.textContent = labels.labelUnavailable ?? '';
    return;
  }

  input.disabled = false;
  input.addEventListener('input', async () => {
    const term = input.value.trim();
    if (!term) {
      list.replaceChildren();
      status.textContent = '';
      return;
    }
    try {
      const search = await pagefind.debouncedSearch(term, {}, DEBOUNCE_MS);
      // null: đã có lượt gõ mới hơn thay thế.
      if (!search) return;
      const data = await Promise.all(search.results.slice(0, MAX_RESULTS).map((r) => r.data()));
      if (input.value.trim() !== term) return;
      // Đếm theo mục thật sự hiển thị (kết quả có URL không hợp lệ đã bị loại).
      const items = data.map(renderResult).filter((li) => li !== undefined);
      list.replaceChildren(...items);
      status.textContent =
        items.length === 0
          ? (labels.labelEmpty ?? '')
          : `${items.length} ${labels.labelResults ?? ''}`;
    } catch {
      list.replaceChildren();
      status.textContent = labels.labelError ?? '';
    }
  });
}
