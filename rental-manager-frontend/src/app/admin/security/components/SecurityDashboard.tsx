'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { SecurityStats } from '@/services/api/security';
import { RefreshCw, AlertTriangle, CheckCircle, Info } from 'lucide-react';

interface SecurityDashboardProps {
  stats: SecurityStats | null;
  onRefresh: () => void;
}

export default function SecurityDashboard({ stats, onRefresh }: SecurityDashboardProps) {
  if (!stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading security statistics...</p>
        </div>
      </div>
    );
  }

  const getScoreStatus = (score: number) => {
    if (score >= 80) return { color: 'bg-green-500', text: 'Excellent', icon: CheckCircle };
    if (score >= 60) return { color: 'bg-yellow-500', text: 'Good', icon: Info };
    if (score >= 40) return { color: 'bg-orange-500', text: 'Fair', icon: AlertTriangle };
    return { color: 'bg-red-500', text: 'Needs Attention', icon: AlertTriangle };
  };

  const scoreStatus = getScoreStatus(stats.security_score);
  const ScoreIcon = scoreStatus.icon;

  return (
    <div className="space-y-6">
      {/* Security Score Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Security Health Score</CardTitle>
              <CardDescription>Overall security posture of your system</CardDescription>
            </div>
            <Button onClick={onRefresh} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <span className="text-2xl font-bold">{stats.security_score.toFixed(0)}%</span>
                <div className="flex items-center gap-2">
                  <ScoreIcon className={`h-5 w-5 ${scoreStatus.color.replace('bg-', 'text-')}`} />
                  <span className="text-sm font-medium">{scoreStatus.text}</span>
                </div>
              </div>
              <Progress value={stats.security_score} className="h-3" />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Most Used Roles */}
        <Card>
          <CardHeader>
            <CardTitle>Most Used Roles</CardTitle>
            <CardDescription>Top roles by user count</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.most_used_roles.map((role, index) => (
                <div key={index} className="flex items-center justify-between">
                  <span className="font-medium">{role.role}</span>
                  <span className="text-sm text-muted-foreground">
                    {role.user_count} users
                  </span>
                </div>
              ))}
              {stats.most_used_roles.length === 0 && (
                <p className="text-sm text-muted-foreground">No role assignments yet</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Security Events */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Security Events</CardTitle>
            <CardDescription>Latest security-related activities</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.recent_security_events.slice(0, 5).map((event, index) => (
                <div key={index} className="flex items-start gap-3 text-sm">
                  <div
                    className={`mt-1 h-2 w-2 rounded-full ${
                      event.success ? 'bg-green-500' : 'bg-red-500'
                    }`}
                  />
                  <div className="flex-1">
                    <div className="font-medium">{event.action}</div>
                    <div className="text-xs text-muted-foreground">
                      {event.user} • {event.resource} • {new Date(event.timestamp).toLocaleString()}
                    </div>
                  </div>
                </div>
              ))}
              {stats.recent_security_events.length === 0 && (
                <p className="text-sm text-muted-foreground">No recent events</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Permission Coverage */}
        <Card>
          <CardHeader>
            <CardTitle>Permission Coverage</CardTitle>
            <CardDescription>Percentage of permissions assigned to roles</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(stats.permission_coverage).map(([resource, coverage]) => (
                <div key={resource}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium capitalize">
                      {resource.replace('_', ' ')}
                    </span>
                    <span className="text-sm text-muted-foreground">{coverage.toFixed(0)}%</span>
                  </div>
                  <Progress value={coverage} className="h-2" />
                </div>
              ))}
              {Object.keys(stats.permission_coverage).length === 0 && (
                <p className="text-sm text-muted-foreground">No permission data available</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Role Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Role Distribution</CardTitle>
            <CardDescription>Number of users per role</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(stats.role_distribution).map(([role, count]) => (
                <div key={role} className="flex items-center justify-between">
                  <span className="font-medium">{role}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-32 bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-primary h-2 rounded-full"
                        style={{
                          width: `${Math.min(100, (count / stats.total_users) * 100)}%`,
                        }}
                      />
                    </div>
                    <span className="text-sm text-muted-foreground min-w-[40px] text-right">
                      {count}
                    </span>
                  </div>
                </div>
              ))}
              {Object.keys(stats.role_distribution).length === 0 && (
                <p className="text-sm text-muted-foreground">No role distribution data</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Security Recommendations */}
      <Card>
        <CardHeader>
          <CardTitle>Security Recommendations</CardTitle>
          <CardDescription>Suggestions to improve your security posture</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {stats.failed_login_attempts_today > 10 && (
              <div className="flex items-start gap-2 p-3 bg-red-50 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-900">High Failed Login Attempts</p>
                  <p className="text-sm text-red-700">
                    {stats.failed_login_attempts_today} failed login attempts detected today.
                    Consider implementing rate limiting or account lockout policies.
                  </p>
                </div>
              </div>
            )}
            
            {stats.total_roles === 0 && (
              <div className="flex items-start gap-2 p-3 bg-yellow-50 rounded-lg">
                <Info className="h-5 w-5 text-yellow-600 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-yellow-900">No Roles Configured</p>
                  <p className="text-sm text-yellow-700">
                    Create roles to implement proper access control in your system.
                  </p>
                </div>
              </div>
            )}
            
            {stats.security_score < 60 && (
              <div className="flex items-start gap-2 p-3 bg-orange-50 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-orange-600 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-orange-900">Low Security Score</p>
                  <p className="text-sm text-orange-700">
                    Your security score is below recommended levels. Review role assignments
                    and permission configurations.
                  </p>
                </div>
              </div>
            )}
            
            {stats.security_score >= 80 && (
              <div className="flex items-start gap-2 p-3 bg-green-50 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-green-900">Good Security Posture</p>
                  <p className="text-sm text-green-700">
                    Your security configuration is well-maintained. Continue monitoring
                    for any unusual activities.
                  </p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}