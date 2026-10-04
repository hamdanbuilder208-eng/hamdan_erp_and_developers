import { Label } from "../ui/Input";

export type SpecialLevels = {
  has_lower_ground: boolean;
  has_ground: boolean;
  has_mezzanine: boolean;
};

const LEVELS: { key: keyof SpecialLevels; label: string; hint?: string }[] = [
  { key: "has_lower_ground", label: "Lower Ground" },
  { key: "has_ground", label: "Ground Floor" },
  { key: "has_mezzanine", label: "Mezzanine", hint: "half-level between Ground and 1st Floor" },
];

/** Which levels besides the numbered floors this project has — only the
 * ticked ones are offered when adding a floor. */
export function SpecialLevelsPicker({
  value,
  onChange,
}: {
  value: SpecialLevels;
  onChange: (value: SpecialLevels) => void;
}) {
  return (
    <div>
      <Label>Also has</Label>
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        {LEVELS.map((level) => (
          <label
            key={level.key}
            className="inline-flex items-center gap-2 text-sm text-navy-900 dark:text-slate-100"
            title={level.hint}
          >
            <input
              type="checkbox"
              className="h-4 w-4 accent-brand-600"
              checked={value[level.key]}
              onChange={(e) => onChange({ ...value, [level.key]: e.target.checked })}
            />
            {level.label}
          </label>
        ))}
      </div>
      <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
        Mezzanine is the half-level between Ground and 1st Floor (e.g. a gallery over a hall).
      </p>
    </div>
  );
}
