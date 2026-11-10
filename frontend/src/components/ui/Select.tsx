import * as React from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Search } from "lucide-react";
import { cn } from "../../lib/utils";

/**
 * Drop-in replacement for a native <select> that adds a search box.
 *
 * Callers keep writing `<Select value onChange={(e) => e.target.value}>` with
 * plain <option>/<optgroup> children. A visually hidden native <select> still
 * holds the value, so `required` validation, `e.target.value` and refs work
 * exactly as before; picking an item sets that select's value and fires a real
 * change event on it.
 */

type Opt = { value: string; label: string; disabled: boolean; group?: string };

function textOf(node: React.ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (React.isValidElement(node)) {
    return textOf((node.props as { children?: React.ReactNode }).children);
  }
  return "";
}

function collect(children: React.ReactNode, out: Opt[], group?: string) {
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) return;
    const props = child.props as {
      children?: React.ReactNode;
      value?: unknown;
      disabled?: boolean;
      label?: string;
    };
    if (child.type === React.Fragment) {
      collect(props.children, out, group);
    } else if (child.type === "optgroup") {
      collect(props.children, out, props.label);
    } else if (child.type === "option") {
      const label = textOf(props.children).trim();
      out.push({
        value: props.value === undefined ? label : String(props.value),
        label,
        disabled: !!props.disabled,
        group,
      });
    }
  });
}

const POPOVER_MAX_HEIGHT = 300;

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, id, value, defaultValue, disabled, onChange, ...props }, ref) => {
  const selectRef = React.useRef<HTMLSelectElement | null>(null);
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const popoverRef = React.useRef<HTMLDivElement>(null);
  const searchRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);

  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [active, setActive] = React.useState(-1);
  const [pos, setPos] = React.useState<{ top: number; left: number; width: number; up: boolean }>();
  const [innerValue, setInnerValue] = React.useState<string | undefined>(
    defaultValue === undefined ? undefined : String(defaultValue),
  );

  const options = React.useMemo(() => {
    const out: Opt[] = [];
    collect(children, out);
    return out;
  }, [children]);

  const current = value !== undefined ? String(value) : innerValue;
  // Like a native select: an unmatched value shows the first enabled option.
  const selected =
    options.find((o) => o.value === current) ?? options.find((o) => !o.disabled) ?? options[0];

  const filtered = React.useMemo(() => {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length) return options;
    return options.filter((o) => {
      const hay = `${o.label} ${o.group ?? ""}`.toLowerCase();
      return terms.every((t) => hay.includes(t));
    });
  }, [options, query]);

  const setRefs = (el: HTMLSelectElement | null) => {
    selectRef.current = el;
    if (typeof ref === "function") ref(el);
    else if (ref) ref.current = el;
  };

  const place = React.useCallback(() => {
    const btn = buttonRef.current;
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    const below = window.innerHeight - r.bottom;
    const up = below < POPOVER_MAX_HEIGHT && r.top > below;
    const width = Math.max(r.width, 220);
    const left = Math.min(r.left, window.innerWidth - width - 8);
    setPos({ top: up ? r.top - 4 : r.bottom + 4, left: Math.max(8, left), width, up });
  }, []);

  const openMenu = (initialQuery = "") => {
    if (disabled) return;
    place();
    setQuery(initialQuery);
    setOpen(true);
  };

  const close = (refocus = true) => {
    setOpen(false);
    setQuery("");
    if (refocus) buttonRef.current?.focus();
  };

  const pick = (opt: Opt) => {
    if (opt.disabled) return;
    const sel = selectRef.current;
    if (sel && sel.value !== opt.value) {
      sel.value = opt.value;
      setInnerValue(opt.value);
      sel.dispatchEvent(new Event("change", { bubbles: true }));
    }
    close();
  };

  // When opening (or filtering), highlight the selected item or the first match.
  React.useEffect(() => {
    if (!open) return;
    const idx = filtered.findIndex((o) => o.value === selected?.value && !o.disabled);
    setActive(idx >= 0 && !query ? idx : filtered.findIndex((o) => !o.disabled));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, query, filtered]);

  React.useEffect(() => {
    if (!open) return;
    searchRef.current?.focus();
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (buttonRef.current?.contains(t) || popoverRef.current?.contains(t)) return;
      close(false);
    };
    const onMove = (e: Event) => {
      if (popoverRef.current?.contains(e.target as Node)) return;
      place();
    };
    document.addEventListener("mousedown", onDown);
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", place);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", place);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, place]);

  React.useEffect(() => {
    if (!open || active < 0) return;
    listRef.current
      ?.querySelector<HTMLElement>(`[data-idx="${active}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  const move = (dir: 1 | -1) => {
    if (!filtered.length) return;
    let i = active;
    for (let n = 0; n < filtered.length; n++) {
      i = (i + dir + filtered.length) % filtered.length;
      if (!filtered[i].disabled) {
        setActive(i);
        return;
      }
    }
  };

  const onButtonKey = (e: React.KeyboardEvent) => {
    if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
      e.preventDefault();
      openMenu();
    } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      // Start typing on a focused dropdown to search straight away.
      e.preventDefault();
      openMenu(e.key);
    }
  };

  const onSearchKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      move(1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      move(-1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (active >= 0 && filtered[active]) pick(filtered[active]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      close();
    } else if (e.key === "Tab") {
      close(false);
    }
  };

  const isPlaceholder = !selected || selected.value === "";

  let lastGroup: string | undefined;

  return (
    <div className={cn("relative flex h-9 w-full text-sm", className)}>
      <button
        ref={buttonRef}
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => (open ? close() : openMenu())}
        onKeyDown={onButtonKey}
        className={cn(
          "flex h-full w-full items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 text-left text-navy-950 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:border-brand-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-navy-700 dark:bg-navy-800 dark:text-slate-100",
          open && "ring-2 ring-brand-500 border-brand-500",
        )}
      >
        <span className={cn("truncate", isPlaceholder && "text-slate-500 dark:text-slate-400")}>
          {selected?.label || " "}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
      </button>

      {/* Holds the real value for forms, `required` checks and e.target.value. */}
      <select
        ref={setRefs}
        value={value}
        defaultValue={defaultValue}
        disabled={disabled}
        onChange={(e) => {
          setInnerValue(e.target.value);
          onChange?.(e);
        }}
        tabIndex={-1}
        aria-hidden="true"
        className="pointer-events-none absolute bottom-0 left-1/2 h-px w-px opacity-0"
        {...props}
      >
        {children}
      </select>

      {open &&
        pos &&
        createPortal(
          <div
            ref={popoverRef}
            style={{
              position: "fixed",
              left: pos.left,
              width: pos.width,
              ...(pos.up
                ? { bottom: window.innerHeight - pos.top }
                : { top: pos.top }),
            }}
            className="z-[70] overflow-hidden rounded-lg border border-slate-200 bg-white text-sm shadow-xl dark:border-navy-700 dark:bg-navy-800"
          >
            <div className="flex items-center gap-2 border-b border-slate-100 px-3 dark:border-navy-700">
              <Search className="h-4 w-4 shrink-0 text-slate-400" />
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onSearchKey}
                placeholder="Search…"
                className="h-9 w-full bg-transparent text-navy-950 placeholder:text-slate-400 focus:outline-none dark:text-slate-100 dark:placeholder:text-slate-500"
              />
            </div>
            <div
              ref={listRef}
              role="listbox"
              className="overflow-y-auto py-1"
              style={{ maxHeight: POPOVER_MAX_HEIGHT - 40 }}
            >
              {filtered.length === 0 && (
                <div className="px-3 py-2 text-slate-500 dark:text-slate-400">No matches</div>
              )}
              {filtered.map((o, i) => {
                const header = o.group !== lastGroup && o.group;
                lastGroup = o.group;
                const isSel = o.value === selected?.value;
                return (
                  <React.Fragment key={`${o.group ?? ""}:${o.value}:${i}`}>
                    {header && (
                      <div className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                        {header}
                      </div>
                    )}
                    <div
                      role="option"
                      aria-selected={isSel}
                      aria-disabled={o.disabled}
                      data-idx={i}
                      onMouseEnter={() => !o.disabled && setActive(i)}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => pick(o)}
                      className={cn(
                        "flex cursor-pointer items-center justify-between gap-2 px-3 py-1.5 text-navy-950 dark:text-slate-100",
                        o.group && "pl-5",
                        i === active && "bg-brand-50 dark:bg-navy-700",
                        o.disabled && "cursor-not-allowed opacity-40",
                        o.value === "" && "text-slate-500 dark:text-slate-400",
                      )}
                    >
                      <span className="truncate">{o.label || " "}</span>
                      {isSel && <Check className="h-4 w-4 shrink-0 text-brand-600" />}
                    </div>
                  </React.Fragment>
                );
              })}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
});
Select.displayName = "Select";
