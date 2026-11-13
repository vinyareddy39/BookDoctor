export const SMS_MOCK_STATE = {
  available: true,
  shouldThrow: false,
  calls: [],
  reset() {
    this.available = true;
    this.shouldThrow = false;
    this.calls = [];
  },
};

export const isAvailableAsync = async () => SMS_MOCK_STATE.available;
export const sendSMSAsync = async (addresses, message) => {
  if (SMS_MOCK_STATE.shouldThrow) {
    throw new Error("SMS permission denied");
  }
  SMS_MOCK_STATE.calls.push({ addresses, message });
  return { result: "sent" };
};
export default { isAvailableAsync, sendSMSAsync, SMS_MOCK_STATE };
