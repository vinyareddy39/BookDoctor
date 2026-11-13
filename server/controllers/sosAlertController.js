/**
 * POST /api/sos/alert — Server-Sent SMS Dispatch Removed.
 * Emergency alerts are dispatched directly via on-device Messages app (expo-sms).
 * Server SMS provider dispatch has been removed for privacy and zero-third-party cost.
 */
export const dispatchSosAlert = async (req, res) => {
  return res.status(200).json({
    success: false,
    disabled: true,
    message: "Server SMS dispatch is disabled. Emergency alerts are dispatched via device Messages app.",
    fallbackRequired: true,
  });
};
