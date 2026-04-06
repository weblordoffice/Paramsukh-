"use client";

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { 
  Calendar, 
  Clock, 
  Trash2, 
  CheckCircle, 
  AlertTriangle,
  Plus,
  RefreshCw
} from 'lucide-react';

export default function CounselingManagementPage() {
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [completeLoading, setCompleteLoading] = useState(false);
  const [exceptions, setExceptions] = useState([]);
  const [services, setServices] = useState([]);
  const [showForm, setShowForm] = useState(false);
  
  const [formData, setFormData] = useState({
    serviceId: '',
    unavailableDate: '',
    reason: 'other',
    notes: ''
  });

  useEffect(() => {
    fetchExceptions();
    fetchServices();
  }, []);

  const fetchExceptions = async () => {
    try {
      const response = await apiClient.get('/counseling/admin/availability-exceptions', {
        params: { upcoming: true }
      });
      const data = response.data;
      if (data.success) {
        setExceptions(data.data.exceptions);
      }
    } catch (error) {
      console.error('Failed to fetch exceptions:', error);
    }
  };

  const fetchServices = async () => {
    try {
      const response = await apiClient.get('/counseling/admin/services');
      const data = response.data;
      if (data.success) {
        setServices(data.data.services);
      }
    } catch (error) {
      console.error('Failed to fetch services:', error);
    }
  };

  const handleCleanupExpired = async () => {
    setCleanupLoading(true);
    try {
      const response = await apiClient.post('/counseling/admin/cleanup-expired');
      const data = response.data;
      if (data.success) {
        toast.success(`Cleaned up ${data.data.cleaned} expired bookings`);
      } else {
        toast.error(data.message || 'Failed to cleanup');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to cleanup expired bookings');
    } finally {
      setCleanupLoading(false);
    }
  };

  const handleAutoComplete = async () => {
    setCompleteLoading(true);
    try {
      const response = await apiClient.post('/counseling/admin/auto-complete');
      const data = response.data;
      if (data.success) {
        toast.success(`Auto-completed ${data.data.completed} bookings`);
      } else {
        toast.error(data.message || 'Failed to auto-complete');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to auto-complete bookings');
    } finally {
      setCompleteLoading(false);
    }
  };

  const handleSubmitException = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await apiClient.post('/counseling/admin/availability-exceptions', formData);
      const data = response.data;
      if (data.success) {
        toast.success('Availability exception created');
        setFormData({ serviceId: '', unavailableDate: '', reason: 'other', notes: '' });
        setShowForm(false);
        fetchExceptions();
      } else {
        toast.error(data.message || 'Failed to create exception');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to create exception');
    }
  };

  const handleDeleteException = async (id: string) => {
    if (!confirm('Delete this availability exception?')) return;
    try {
      const response = await apiClient.delete(`/counseling/admin/availability-exceptions/${id}`);
      const data = response.data;
      if (data.success) {
        toast.success('Exception deleted');
        fetchExceptions();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to delete exception');
    }
  };

  const getReasonBadge = (reason) => {
    const colors = {
      holiday: 'bg-blue-100 text-blue-800',
      sick_leave: 'bg-red-100 text-red-800',
      personal: 'bg-purple-100 text-purple-800',
      training: 'bg-yellow-100 text-yellow-800',
      other: 'bg-gray-100 text-gray-800'
    };
    const labels = {
      holiday: 'Holiday',
      sick_leave: 'Sick Leave',
      personal: 'Personal',
      training: 'Training',
      other: 'Other'
    };
    return (
      <Badge className={colors[reason]}>
        {labels[reason]}
      </Badge>
    );
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">Counseling Management</h1>
        <p className="text-gray-500 mt-1">Manage bookings, cleanup, and availability</p>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5" />
              Cleanup Expired Bookings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-500 mb-4">
              Cancel unpaid bookings that are older than 30 minutes
            </p>
            <Button 
              onClick={handleCleanupExpired} 
              disabled={cleanupLoading}
              className="w-full"
            >
              {cleanupLoading ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Cleaning...
                </>
              ) : (
                'Run Cleanup'
              )}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5" />
              Auto-Complete Past Sessions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-500 mb-4">
              Mark yesterday&apos;s confirmed bookings as completed
            </p>
            <Button 
              onClick={handleAutoComplete} 
              disabled={completeLoading}
              className="w-full"
            >
              {completeLoading ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                'Auto-Complete'
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Availability Exceptions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Availability Exceptions
            </CardTitle>
            <Button onClick={() => setShowForm(!showForm)} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Exception
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {showForm && (
            <form onSubmit={handleSubmitException} className="space-y-4 mb-6 p-4 border rounded-lg">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label>Service</Label>
                  <Select 
                    value={formData.serviceId} 
                    onValueChange={(value) => setFormData({ ...formData, serviceId: value })}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select service" />
                    </SelectTrigger>
                    <SelectContent>
                      {services.map((service) => (
                        <SelectItem key={service._id} value={service._id}>
                          {service.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Unavailable Date</Label>
                  <Input
                    type="date"
                    value={formData.unavailableDate}
                    onChange={(e) => setFormData({ ...formData, unavailableDate: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div>
                <Label>Reason</Label>
                <Select 
                  value={formData.reason} 
                  onValueChange={(value) => setFormData({ ...formData, reason: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="holiday">Holiday</SelectItem>
                    <SelectItem value="sick_leave">Sick Leave</SelectItem>
                    <SelectItem value="personal">Personal</SelectItem>
                    <SelectItem value="training">Training</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Notes (Optional)</Label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Additional details..."
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit">Create Exception</Button>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          )}

          {exceptions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Calendar className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No upcoming availability exceptions</p>
            </div>
          ) : (
            <div className="space-y-3">
              {exceptions.map((exception) => (
                <div 
                  key={exception._id} 
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center gap-4">
                    <Calendar className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="font-medium">{exception.serviceId?.title || 'Unknown Service'}</p>
                      <p className="text-sm text-gray-500">
                        {new Date(exception.unavailableDate).toLocaleDateString('en-US', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </p>
                    </div>
                    {getReasonBadge(exception.reason)}
                  </div>
                  <div className="flex items-center gap-2">
                    {exception.notes && (
                      <AlertTriangle className="h-4 w-4 text-yellow-500" title={exception.notes} />
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteException(exception._id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
