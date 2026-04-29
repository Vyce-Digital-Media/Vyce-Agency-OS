<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Deliverable;
use Illuminate\Http\Request;

class DeliverableController extends Controller
{
    public function index(Request $request)
    {
        $this->authorize('viewAny', Deliverable::class);

        $query = Deliverable::query()->with(['plan.client', 'assignedUser.profile', 'assets']);
        if ($request->user()->hasRole('client')) {
            $query->whereHas('plan.client', fn ($q) => $q->where('user_id', $request->user()->id));
        }

        return response()->json(['data' => $query->latest('due_date')->get()]);
    }

    public function store(Request $request)
    {
        $this->authorize('create', Deliverable::class);

        return response()->json(['data' => Deliverable::create($this->validated($request))], 201);
    }

    public function show(Deliverable $deliverable)
    {
        $this->authorize('view', $deliverable);

        return response()->json(['data' => $deliverable->load(['plan.client', 'assets'])]);
    }

    public function update(Request $request, Deliverable $deliverable)
    {
        $this->authorize('update', $deliverable);

        $data = $this->validated($request, false);
        if (($data['status'] ?? null) === 'approved') {
            $data['approved_by'] = $request->user()->id;
            $data['approved_at'] = now();
        }

        $deliverable->update($data);

        return response()->json(['data' => $deliverable->fresh()]);
    }

    public function destroy(Deliverable $deliverable)
    {
        $this->authorize('delete', $deliverable);
        $deliverable->delete();

        return response()->json(['success' => true]);
    }

    private function validated(Request $request, bool $creating = true): array
    {
        return $request->validate([
            'plan_id' => [$creating ? 'required' : 'sometimes', 'exists:monthly_plans,id'],
            'title' => [$creating ? 'required' : 'sometimes', 'string', 'max:255'],
            'type' => ['sometimes', 'in:post,reel,story,ad,campaign,blog,newsletter,other'],
            'status' => ['sometimes', 'in:not_started,in_progress,in_review,needs_approval,approved,delivered'],
            'due_date' => ['sometimes', 'nullable', 'date'],
            'assigned_to' => ['sometimes', 'nullable', 'exists:users,id'],
            'description' => ['sometimes', 'nullable', 'string'],
            'priority' => ['sometimes', 'string', 'max:40'],
        ]);
    }
}
