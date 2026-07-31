import Transaction from '../models/transaction.models.js';

export const recordTransaction = async ({
  userId,
  userName,
  source,
  sourceId,
  amount,
  status = 'success',
  provider = 'razorpay',
  providerRef = '',
  metadata = {},
  refundAmount = 0,
  refundedAt = null,
}) => {
  try {
    await Transaction.create({
      userId,
      userName,
      source,
      sourceId,
      amount,
      status,
      provider,
      providerRef,
      metadata,
      refundAmount,
      refundedAt,
    });
  } catch (error) {
    if (error.code !== 11000) {
      console.error(`Failed to record transaction for ${source}:${sourceId}`, error.message);
    }
  }
};

export const recordRefund = async ({ sourceId, refundAmount }) => {
  try {
    const tx = await Transaction.findOne({ sourceId, status: 'success' });
    if (tx) {
      tx.status = 'refunded';
      tx.refundAmount = refundAmount || tx.amount;
      tx.refundedAt = new Date();
      await tx.save();
    }
  } catch (error) {
    console.error(`Failed to record refund for ${sourceId}`, error.message);
  }
};
