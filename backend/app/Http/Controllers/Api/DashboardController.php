<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Client;
use App\Models\Deliverable;
use App\Models\MonthlyPlan;
use App\Models\TimeEntry;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();

        $plans = MonthlyPlan::query()->with('client')->when($user->hasRole('client'), fn ($q) => $q->whereHas('client', fn ($c) => $c->where('user_id', $user->id)))->get()->map(function ($plan) {
            $arr = $plan->toArray();
            $arr['clients'] = $arr['client'] ?? null;
            unset($arr['client']);
            return $arr;
        });

        $deliverables = Deliverable::query()->with('plan.client')->when($user->hasRole('client'), fn ($q) => $q->whereHas('plan.client', fn ($c) => $c->where('user_id', $user->id)))->get()->map(function ($deliverable) {
            $arr = $deliverable->toArray();
            if (!empty($arr['plan'])) {
                $plan = $arr['plan'];
                $plan['clients'] = $plan['client'] ?? null;
                unset($plan['client']);
                $arr['monthly_plans'] = $plan;
            } else {
                $arr['monthly_plans'] = null;
            }
            unset($arr['plan']);
            return $arr;
        });

        $totalEstimated = Deliverable::query()->whereNotIn('status', ['approved', 'delivered'])->sum('estimated_minutes');
        $totalActual = TimeEntry::query()->whereNull('clock_out')->count() === 0 
            ? TimeEntry::query()->sum('duration_seconds') 
            : TimeEntry::query()->sum('duration_seconds'); // Simple sum for now

        return response()->json([
            'clients' => Client::query()->when($user->hasRole('client'), fn ($q) => $q->where('user_id', $user->id))->get(),
            'monthly_plans' => $plans,
            'deliverables' => $deliverables,
            'time_entries' => TimeEntry::query()->when(! $user->hasAnyRole(['admin', 'manager']), fn ($q) => $q->where('user_id', $user->id))->latest('clock_in')->limit(100)->get(),
            'analytics' => $user->hasAnyRole(['admin', 'manager']) ? [
                'total_estimated_hours' => round($totalEstimated / 60, 1),
                'total_actual_hours' => round($totalActual / 3600, 1),
            ] : null,
        ]);
    }
}
