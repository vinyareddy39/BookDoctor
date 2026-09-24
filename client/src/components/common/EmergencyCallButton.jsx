import React from "react";
import { formatDialNumber, formatDisplayNumber, initiateDeviceCall } from "../../services/locationService";

/**
 * Reusable Emergency Call Button
 * 
 * Features:
 * - Dynamically loads the configured emergency phone number.
 * - Immediately triggers the native device calling interface using `tel:`.
 * - Zero webpage navigation or external app redirection.
 * - Fully customizable styling, icon, and display label.
 */
export default function EmergencyCallButton({
  phoneNumber,
  label,
  showIcon = true,
  icon = "🚑",
  className = "",
  onClick,
  ...props
}) {
  const dialNumber = formatDialNumber(phoneNumber);
  const displayNumber = formatDisplayNumber(phoneNumber);

  const handleClick = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (onClick) onClick(e, dialNumber);
    initiateDeviceCall(dialNumber);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={`Call emergency number ${displayNumber}`}
      className={
        className ||
        "py-2.5 px-3 bg-red-600 hover:bg-red-700 active:scale-95 text-white font-bold rounded-lg transition text-xs flex items-center justify-center gap-1 shadow-sm"
      }
      {...props}
    >
      {showIcon && <span>{icon}</span>}
      <span>{label || displayNumber}</span>
    </button>
  );
}
