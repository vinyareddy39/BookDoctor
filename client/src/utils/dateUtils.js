/** Map day names (any format) → JS getDay() index (0=Sun … 6=Sat) */
export const DAY_MAP = {
  sunday: 0,    sun: 0,
  monday: 1,    mon: 1,
  tuesday: 2,   tue: 2,
  wednesday: 3, wed: 3,
  thursday: 4,  thu: 4,
  friday: 5,    fri: 5,
  saturday: 6,  sat: 6,
};

/**
 * Parse doctor.availableDays (array like ["Mon","Wed","Fri"] or ["Monday","Wednesday"])
 * → Set of JS day-of-week numbers: {1, 3, 5}
 */
export function parseAllowedDays(availableDays = []) {
  const allowed = new Set();
  availableDays.forEach((d) => {
    const key = d.trim().toLowerCase();
    if (DAY_MAP[key] !== undefined) allowed.add(DAY_MAP[key]);
  });
  return allowed;
}

/**
 * Given a date string "YYYY-MM-DD", check if that day of week is allowed.
 * NOTE: We parse with no timezone offset so the date stays local.
 */
export function isDateAllowed(dateStr, allowedSet) {
  if (!dateStr || allowedSet.size === 0) return true; // no restriction if no days configured
  const [y, m, d] = dateStr.split("-").map(Number);
  const dayOfWeek = new Date(y, m - 1, d).getDay(); // local date — no UTC shift
  return allowedSet.has(dayOfWeek);
}

/**
 * Build the nearest valid date on or after today that falls on an allowed day.
 * Returns "YYYY-MM-DD" string or "" if no allowed days configured.
 */
export function nearestAllowedDate(allowedSet) {
  if (allowedSet.size === 0) return "";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 0; i < 30; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    if (allowedSet.has(d.getDay())) {
      return d.toISOString().split("T")[0];
    }
  }
  return "";
}

/** Parse "10:00 AM - 5:00 PM" → 30-min slot array */
export function generateTimeSlots(availableTime) {
  if (!availableTime) return [];
  const parts = availableTime.split("-").map((s) => s.trim());
  if (parts.length < 2) return [];

  const parseTime = (str) => {
    const match = str.match(/(\d+):?(\d*)\s*(AM|PM)/i);
    if (!match) return null;
    let h = parseInt(match[1]);
    const m = parseInt(match[2] || "0");
    const ampm = match[3].toUpperCase();
    if (ampm === "PM" && h !== 12) h += 12;
    if (ampm === "AM" && h === 12) h = 0;
    return h * 60 + m;
  };

  const startMin = parseTime(parts[0]);
  const endMin   = parseTime(parts[1]);
  if (startMin === null || endMin === null || startMin >= endMin) return [];

  const slots = [];
  for (let m = startMin; m <= endMin; m += 30) {
    const h24  = Math.floor(m / 60);
    const min  = m % 60;
    const ampm = h24 < 12 ? "AM" : "PM";
    const h12  = h24 % 12 === 0 ? 12 : h24 % 12;
    slots.push(`${h12}:${min.toString().padStart(2, "0")} ${ampm}`);
  }
  return slots;
}

/** Format "YYYY-MM-DD" → "Monday, 30 June 2026" */
export function formatDateDisplay(dateStr) {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-IN", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}
