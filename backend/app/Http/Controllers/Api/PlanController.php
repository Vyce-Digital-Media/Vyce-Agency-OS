<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\MonthlyPlan;
use Illuminate\Http\Request;

class PlanController extends Controller
{
    public function index(Request $request)
    {
        $this->authorize('viewAny', MonthlyPlan::class);

        $query = MonthlyPlan::query()->with('client')->latest('start_date');
        if ($request->user()->hasRole('client')) {
            $query->whereHas('client', fn ($q) => $q->where('user_id', $request->user()->id));
        }

        $plans = $query->get()->map(function ($plan) {
            $arr = $plan->toArray();
            $arr['clients'] = $arr['client'] ?? null;
            unset($arr['client']);
            return $arr;
        });

        return response()->json(['data' => $plans]);
    }

    public function store(Request $request)
    {
        $this->authorize('create', MonthlyPlan::class);

        $data = $this->validated($request);
        $data['created_by'] = $request->user()->id;

        return response()->json(['data' => MonthlyPlan::create($data)], 201);
    }

    public function show(MonthlyPlan $plan)
    {
        $this->authorize('view', $plan);

        return response()->json(['data' => $plan->load(['client', 'deliverables'])]);
    }

    public function update(Request $request, MonthlyPlan $plan)
    {
        $this->authorize('update', $plan);
        $plan->update($this->validated($request, false));

        return response()->json(['data' => $plan]);
    }

    public function destroy(MonthlyPlan $plan)
    {
        $this->authorize('delete', $plan);
        $plan->delete();

        return response()->json(['success' => true]);
    }

    private function validated(Request $request, bool $creating = true): array
    {
        return $request->validate([
            'client_id' => [$creating ? 'required' : 'sometimes', 'exists:clients,id'],
            'month' => [$creating ? 'required' : 'sometimes', 'integer', 'between:1,12'],
            'year' => [$creating ? 'required' : 'sometimes', 'integer', 'between:2000,2100'],
            'total_deliverables' => ['sometimes', 'integer', 'min:0'],
            'status' => ['sometimes', 'in:draft,active,completed,archived'],
            'notes' => ['sometimes', 'nullable', 'string'],
            'deliverables_breakdown' => ['sometimes', 'nullable', 'array'],
            'description' => ['sometimes', 'nullable', 'string'],
            'start_date' => ['sometimes', 'nullable', 'date'],
            'end_date' => ['sometimes', 'nullable', 'date'],
            'plan_type' => ['sometimes', 'string', 'max:255'],
        ]);
    }
}
