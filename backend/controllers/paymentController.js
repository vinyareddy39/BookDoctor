export const createOrder = async (req, res) => { res.status(200).json({ success: true, message: 'Order created' }); };
export const verifyPayment = async (req, res) => { res.status(200).json({ success: true, message: 'Payment verified' }); };
