import * as React from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Search, X } from "lucide-react";
import { api } from "../../lib/api";

interface SearchResult {
  category: string;
  id: number;
  title: string;
  subtitle: string | null;
  url: string;
}

export function GlobalSearch() {
  const navigate = useNavigate();
  const [query, setQuery] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const t = window.setTimeout(() => setDebounced(query.trim()), 300);
    return () => window.clearTimeout(t);
  }, [query]);

  const { data: results, isFetching } = useQuery({
    queryKey: ["global-search", debounced],
    queryFn: async () =>
      (await api.get<SearchResult[]>("/search/", { params: { q: debounced } })).data,
    enabled: debounced.length >= 2,
  });

  React.useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const grouped = React.useMemo(() => {
    const map = new Map<string, SearchResult[]>();
    for (const r of results ?? []) {
      if (!map.has(r.category)) map.set(r.category, []);
      map.get(r.category)!.push(r);
    }
    return Array.from(map.entries());
  }, [results]);

  const handleSelect = (r: SearchResult) => {
    navigate(r.url);
    setQuery("");
    setDebounced("");
    setOpen(false);
  };

  const clear = () => {
    setQuery("");
    setDebounced("");
    setOpen(false);
  };

  const showDropdown = open && debounced.length >= 2;

  return (
    <div ref={containerRef} className="relative hidden sm:block">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
      <input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            clear();
            (e.target as HTMLInputElement).blur();
          }
        }}
        placeholder="Search customers, bookings, units..."
        className="h-9 w-64 rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-8 text-sm text-navy-950 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-navy-700 dark:bg-navy-800 dark:text-slate-100 dark:placeholder:text-slate-500"
      />
      {query && (
        <button
          onClick={clear}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          aria-label="Clear search"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}

      {showDropdown && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1.5 max-h-96 overflow-y-auto rounded-lg border border-slate-200 bg-white py-1.5 shadow-lg dark:border-navy-700 dark:bg-navy-900">
          {isFetching && (
            <p className="px-3 py-2 text-xs text-slate-400 dark:text-slate-500">Searching...</p>
          )}
          {!isFetching && (results?.length ?? 0) === 0 && (
            <p className="px-3 py-2 text-xs text-slate-400 dark:text-slate-500">
              No results for "{debounced}".
            </p>
          )}
          {grouped.map(([category, items]) => (
            <div key={category}>
              <p className="px-3 pt-1.5 pb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                {category}
              </p>
              {items.map((r) => (
                <button
                  key={`${r.category}-${r.id}`}
                  onClick={() => handleSelect(r)}
                  className="flex w-full flex-col items-start px-3 py-1.5 text-left text-sm hover:bg-slate-50 dark:hover:bg-navy-800"
                >
                  <span className="font-medium text-navy-900 dark:text-slate-100">{r.title}</span>
                  {r.subtitle && (
                    <span className="text-xs text-slate-400 dark:text-slate-500">{r.subtitle}</span>
                  )}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
