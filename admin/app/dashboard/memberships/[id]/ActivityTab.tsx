"use client";

import { useState, useEffect, useCallback } from "react";
import { Activity, Calendar, LogIn, UserCheck } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import toast from "react-hot-toast";

interface ActivityLog {
  _id: string;
  type: string;
  description: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

interface ActivityTabProps {
  userId: string;
}

export default function ActivityTab({ userId }: ActivityTabProps) {
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchActivity = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiClient.get(`/api/user/${userId}/activity`);
      if (response.data.success) {
        setActivities(response.data.activities || []);
      }
    } catch (error: any) {
      console.error("Error fetching activity:", error);
      // Don't show error toast if endpoint doesn't exist yet
      if (error.response?.status !== 404) {
        toast.error(error.response?.data?.message || "Failed to fetch activity");
      }
      // Set empty activities if endpoint not implemented
      setActivities([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchActivity();
  }, [userId, fetchActivity]);

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'login':
        return <LogIn className="w-5 h-5 text-blue-500" />;
      case 'enrollment':
        return <UserCheck className="w-5 h-5 text-green-500" />;
      case 'payment':
        return <Calendar className="w-5 h-5 text-purple-500" />;
      default:
        return <Activity className="w-5 h-5 text-gray-500" />;
    }
  };

  const getActivityColor = (type: string) => {
    const colors: Record<string, string> = {
      login: 'bg-blue-50 border-blue-200',
      enrollment: 'bg-green-50 border-green-200',
      payment: 'bg-purple-50 border-purple-200',
      default: 'bg-gray-50 border-gray-200'
    };
    return colors[type] || colors.default;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Activity Timeline */}
      {activities.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
          <Activity className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No activity logs</h3>
          <p className="mt-1 text-sm text-gray-500">
            Activity tracking may not be enabled for this user.
          </p>
        </div>
      ) : (
        <div className="relative">
          {/* Timeline Line */}
          <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gray-200"></div>

          {/* Activity Items */}
          <div className="space-y-6">
            {activities.map((activity) => (
              <div key={activity._id} className="relative flex gap-4">
                {/* Timeline Dot */}
                <div className={`flex-shrink-0 w-16 h-16 rounded-full ${getActivityColor(activity.type)} border-2 flex items-center justify-center z-10`}>
                  {getActivityIcon(activity.type)}
                </div>

                {/* Activity Content */}
                <div className="flex-1 bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-medium text-gray-900">{activity.description}</h4>
                      <p className="text-sm text-gray-500 mt-1">
                        {new Date(activity.timestamp).toLocaleString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                    <span className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded">
                      {activity.type}
                    </span>
                  </div>

                  {/* Metadata */}
                  {activity.metadata && Object.keys(activity.metadata).length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <dl className="grid grid-cols-2 gap-2 text-sm">
                        {Object.entries(activity.metadata).map(([key, value]) => (
                          <div key={key}>
                            <dt className="text-gray-500 capitalize">{key}:</dt>
                            <dd className="text-gray-900 font-medium">{String(value)}</dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
