import { useState } from "react";

const dateRangeLabels = {
  today: "Today",
  yesterday: "Yesterday",
  week: "This Week",
  month: "This Month",
  last_month: "Last Month",
  custom: "Custom",
};

const options = ["today", "yesterday", "week", "month", "last_month", "custom"];

export default function DateRangePicker({ value, onChange }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-2 bg-surface border border-line rounded-lg text-sm font-medium text-ink2 hover:border-line2 hover:bg-surface2 transition-colors"
      >
        <svg className="w-4 h-4 text-ink3" viewBox="0 0 16 16" fill="none">
          <rect x="1" y="2" width="14" height="13" rx="2" stroke="currentColor" strokeWidth="1.25" />
          <path d="M5 1v2M11 1v2M1 6h14" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
        </svg>
        {dateRangeLabels[value]}
        <svg className="w-3.5 h-3.5 text-ink4" viewBox="0 0 14 14" fill="none">
          <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1.5 z-20 bg-surface border border-line rounded-xl shadow-lg py-1.5 min-w-[168px]">
            {options.map((opt) => (
              <button
                key={opt}
                onClick={() => { onChange(opt); setOpen(false); }}
                className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                  value === opt
                    ? "text-brand font-medium bg-brand-light"
                    : "text-ink2 hover:bg-surface2"
                }`}
              >
                {dateRangeLabels[opt]}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
