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

        return response()->json([
            'clients' => Client::query()->when($user->hasRole('client'), fn ($q) => $q->where('user_id', $user->id))->get(),
            'monthly_plans' => MonthlyPlan::query()->with('client')->when($user->hasRole('client'), fn ($q) => $q->whereHas('client', fn ($c) => $c->where('user_id', $user->id)))->get(),
            'deliverables' => Deliverable::query()->with('plan.client')->when($user->hasRole('client'), fn ($q) => $q->whereHas('plan.client', fn ($c) => $c->where('user_id', $user->id)))->get(),
            'time_entries' => TimeEntry::query()->when(! $user->hasAnyRole(['admin', 'manager']), fn ($q) => $q->where('user_id', $user->id))->latest('clock_in')->limit(100)->get(),
        ]);
    }
}
