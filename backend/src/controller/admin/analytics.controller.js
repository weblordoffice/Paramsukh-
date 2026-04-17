import { User } from '../../models/user.models.js';
import { Enrollment } from '../../models/enrollment.models.js';
import Order from '../../models/order.models.js';
import { EventRegistration } from '../../models/eventRegistration.models.js';
import { Event } from '../../models/event.models.js';

export const getBasicAnalytics = async (req, res) => {
    try {
        // 1. User Analytics: Active vs Inactive
        // Active: Logged in within last 30 days
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
        
        const [totalUsers, activeUsers] = await Promise.all([
            User.countDocuments(),
            User.countDocuments({ updatedAt: { $gte: thirtyDaysAgo } })
        ]);

        // 2. Course Analytics: Drop-out Rate
        // Drop-out: Started but progress < 50% after a certain time (or just static stats)
        const [totalEnrollments, completedEnrollments, inProgressEnrollments] = await Promise.all([
            Enrollment.countDocuments(),
            Enrollment.countDocuments({ isCompleted: true }),
            Enrollment.countDocuments({ isCompleted: false, progress: { $gt: 0 } })
        ]);
        
        const dropOutRate = totalEnrollments > 0 
            ? Math.round(((totalEnrollments - completedEnrollments) / totalEnrollments) * 100) 
            : 0;

        // 3. Revenue Analytics: Renewal Rate (Basic approximation based on multiple orders)
        const renewalAggr = await Order.aggregate([
            { $match: { status: 'completed' } },
            { $group: { _id: "$userId", count: { $sum: 1 } } },
            { $group: { _id: null, repeatUsers: { $sum: { $cond: [{ $gt: ["$count", 1] }, 1, 0] } }, totalUsers: { $sum: 1 } } }
        ]);
        
        const renewalRate = (renewalAggr.length > 0 && renewalAggr[0].totalUsers > 0)
            ? Math.round((renewalAggr[0].repeatUsers / renewalAggr[0].totalUsers) * 100)
            : 0;

        // 4. Event Analytics: Conversion Rate
        // Simplified: (Confirmed Registrations / Total Events) or vs a target
        const [totalEvents, totalRegistrations] = await Promise.all([
            Event.countDocuments(),
            EventRegistration.countDocuments({ status: { $in: ['confirmed', 'completed'] } })
        ]);
        
        const eventConvRate = totalEvents > 0 
            ? Math.round(totalRegistrations / totalEvents) 
            : 0;

        return res.status(200).json({
            success: true,
            data: {
                users: {
                    total: totalUsers,
                    active: activeUsers,
                    inactive: totalUsers - activeUsers,
                    activePercentage: totalUsers > 0 ? Math.round((activeUsers / totalUsers) * 100) : 0
                },
                courses: {
                    totalEnrollments,
                    completedEnrollments,
                    dropOutRate
                },
                revenue: {
                    renewalRate,
                    totalOrders: renewalAggr.length > 0 ? renewalAggr[0].totalUsers : 0
                },
                events: {
                    totalEvents,
                    totalRegistrations,
                    conversionRate: eventConvRate
                },
                charts: {
                    userGrowth: await User.aggregate([
                        { $match: { createdAt: { $gte: ninetyDaysAgo } } },
                        { $group: {
                            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                            count: { $sum: 1 }
                        }},
                        { $sort: { "_id": 1 } }
                    ]),
                    revenueTrend: await Order.aggregate([
                        { $match: { status: 'completed', createdAt: { $gte: ninetyDaysAgo } } },
                        { $group: {
                            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                            total: { $sum: "$totalAmount" }
                        }},
                        { $sort: { "_id": 1 } }
                    ])
                }
            }
        });

    } catch (error) {
        console.error("❌ Error fetching analytics:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};
