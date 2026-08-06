import Transaction from '../../models/transaction.models.js';
import { getRevenueStats } from '../../services/revenue.service.js';

export const getRevenueDashboard = async (req, res) => {
  try {
    const { startDate, endDate, source } = req.query;
    const stats = await getRevenueStats({ startDate, endDate, source });
    return res.json({ success: true, data: stats });
  } catch (error) {
    console.error('Revenue dashboard error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getTransactions = async (req, res) => {
  try {
    const { page = 1, limit = 20, search, source, status, startDate, endDate, sort = '-createdAt' } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const match = {};
    if (source) match.source = source;
    if (status) match.status = status;
    if (startDate || endDate) {
      match.createdAt = {};
      if (startDate) match.createdAt.$gte = new Date(startDate);
      if (endDate) match.createdAt.$lte = new Date(endDate);
    }
    if (search) {
      match.$or = [
        { userName: { $regex: search, $options: 'i' } },
        { sourceId: { $regex: search, $options: 'i' } },
        { providerRef: { $regex: search, $options: 'i' } },
        { 'metadata.planName': { $regex: search, $options: 'i' } },
        { 'metadata.courseName': { $regex: search, $options: 'i' } },
        { 'metadata.productName': { $regex: search, $options: 'i' } },
        { 'metadata.eventName': { $regex: search, $options: 'i' } },
      ];
    }

    const sortDir = sort.startsWith('-') ? -1 : 1;
    const sortField = sort.startsWith('-') ? sort.substring(1) : sort;

    const [transactions, total] = await Promise.all([
      Transaction.find(match)
        .sort({ [sortField]: sortDir })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Transaction.countDocuments(match),
    ]);

    return res.json({
      success: true,
      data: transactions,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) },
    });
  } catch (error) {
    console.error('Get transactions error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const exportTransactions = async (req, res) => {
  try {
    const { startDate, endDate, source, status } = req.query;
    const match = {};
    if (source) match.source = source;
    if (status) match.status = status;
    if (startDate || endDate) {
      match.createdAt = {};
      if (startDate) match.createdAt.$gte = new Date(startDate);
      if (endDate) match.createdAt.$lte = new Date(endDate);
    }

    const transactions = await Transaction.find(match).sort({ createdAt: -1 }).lean();

    const header = 'Date,User,Source,Amount,Status,Provider Ref,Related\n';
    const rows = transactions.map(t => {
      const date = new Date(t.createdAt).toISOString().split('T')[0];
      const related = t.metadata?.planName || t.metadata?.courseName || t.metadata?.productName || t.metadata?.eventName || t.source;
      return `${date},"${t.userName || '-'}",${t.source},${t.amount},${t.status},${t.providerRef || '-'},"${related}"`;
    }).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=revenue-transactions-${new Date().toISOString().split('T')[0]}.csv`);
    return res.send(header + rows);
  } catch (error) {
    console.error('Export transactions error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getTransactionById = async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id).lean();
    if (!transaction) return res.status(404).json({ success: false, message: 'Transaction not found' });
    return res.json({ success: true, data: transaction });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
