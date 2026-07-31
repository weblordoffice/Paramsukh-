import Transaction from '../models/transaction.models.js';

export const getRevenueStats = async ({ startDate, endDate, source } = {}) => {
  const match = {};
  const successMatch = { ...match, status: 'success' };
  const refundMatch = { ...match, status: 'refunded' };
  const failedMatch = { ...match, status: 'failed' };

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfYear = new Date(now.getFullYear(), 0, 1);

  if (startDate) {
    match.createdAt = { $gte: new Date(startDate) };
    successMatch.createdAt = match.createdAt;
    refundMatch.createdAt = match.createdAt;
    failedMatch.createdAt = match.createdAt;
  }
  if (endDate) {
    match.createdAt = { ...(match.createdAt || {}), $lte: new Date(endDate) };
    successMatch.createdAt = { ...(successMatch.createdAt || {}), $lte: new Date(endDate) };
    refundMatch.createdAt = { ...(refundMatch.createdAt || {}), $lte: new Date(endDate) };
    failedMatch.createdAt = { ...(failedMatch.createdAt || {}), $lte: new Date(endDate) };
  }
  if (source) {
    match.source = source;
    successMatch.source = source;
    refundMatch.source = source;
    failedMatch.source = source;
  }

  const dayFilter = (start) => ({ ...(startDate ? { createdAt: { $gte: new Date(startDate) } } : { createdAt: { $gte: start } }), ...(source ? { source } : {}) });

  const [
    totalSuccess,
    totalRefund,
    totalFailed,
    todaySuccess,
    monthSuccess,
    yearSuccess,
    totalCount,
    sourceBreakdown,
    dailyRevenue,
    monthlyRevenue,
    avgOrder,
  ] = await Promise.all([
    Transaction.aggregate([{ $match: successMatch }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
    Transaction.aggregate([{ $match: refundMatch }, { $group: { _id: null, total: { $sum: '$refundAmount' } } }]),
    Transaction.countDocuments(failedMatch),
    Transaction.aggregate([{ $match: { ...dayFilter(startOfToday), status: 'success' } }, { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }]),
    Transaction.aggregate([{ $match: { ...dayFilter(startOfMonth), status: 'success' } }, { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }]),
    Transaction.aggregate([{ $match: { ...dayFilter(startOfYear), status: 'success' } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
    Transaction.countDocuments(successMatch),
    Transaction.aggregate([
      { $match: successMatch },
      { $group: { _id: '$source', total: { $sum: '$amount' }, count: { $sum: 1 } } },
      { $sort: { total: -1 } }
    ]),
    Transaction.aggregate([
      { $match: { ...successMatch, createdAt: { $gte: startOfYear, ...(successMatch.createdAt || {}) } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, total: { $sum: '$amount' }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]),
    Transaction.aggregate([
      { $match: { ...successMatch, createdAt: { $gte: startOfYear, ...(successMatch.createdAt || {}) } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } }, total: { $sum: '$amount' }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]),
    Transaction.aggregate([{ $match: successMatch }, { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }]),
  ]);

  const totalRevenue = totalSuccess[0]?.total || 0;
  const totalRefundAmount = totalRefund[0]?.total || 0;
  const successCount = avgOrder[0]?.count || 1;

  return {
    overview: {
      totalRevenue,
      totalRefundAmount,
      totalFailedTransactions: totalFailed,
      totalTransactions: totalCount + totalFailed,
      successCount: avgOrder[0]?.count || 0,
      revenueToday: todaySuccess[0]?.total || 0,
      revenueThisMonth: monthSuccess[0]?.total || 0,
      revenueThisYear: yearSuccess[0]?.total || 0,
      transactionsToday: todaySuccess[0]?.count || 0,
      transactionsThisMonth: monthSuccess[0]?.count || 0,
      averageOrderValue: Math.round(totalRevenue / successCount) || 0,
      netRevenue: totalRevenue - totalRefundAmount,
    },
    sourceBreakdown: sourceBreakdown.map(s => ({
      source: s._id,
      revenue: s.total,
      transactions: s.count,
      percentage: totalRevenue > 0 ? Math.round((s.total / totalRevenue) * 100) : 0,
    })),
    charts: {
      daily: dailyRevenue,
      monthly: monthlyRevenue,
    },
  };
};
