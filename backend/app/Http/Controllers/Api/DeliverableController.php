<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Deliverable;
use App\Models\Notification;
use App\Models\UserRole;
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

        $deliverables = $query->latest('due_date')->get()->map(function ($deliverable) {
            $arr = $deliverable->toArray();
            // Remap 'plan' -> 'monthly_plans' with nested 'client' -> 'clients'
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

        return response()->json(['data' => $deliverables]);
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

        $oldStatus = $deliverable->status;
        $data = $this->validated($request, false);
        if (($data['status'] ?? null) === 'approved') {
            $data['approved_by'] = $request->user()->id;
            $data['approved_at'] = now();
        }

        $deliverable->update($data);
        $deliverable->refresh();

        // Fire notifications on status change
        $newStatus = $data['status'] ?? null;
        if ($newStatus && $newStatus !== $oldStatus) {
            $this->fireStatusNotifications($deliverable, $oldStatus, $newStatus);
        }

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

    /**
     * Create in-app notifications for stakeholders when a deliverable status changes.
     */
    private function fireStatusNotifications(Deliverable $deliverable, string $oldStatus, string $newStatus): void
    {
        $title = $deliverable->title;
        $deliverableId = $deliverable->id;

        // Notify managers/admins when team pushes to review or approval
        if (in_array($newStatus, ['in_review', 'needs_approval'])) {
            $label = $newStatus === 'needs_approval' ? 'Needs Approval' : 'In Review';
            $managerIds = UserRole::whereIn('role', ['admin', 'manager'])->pluck('user_id');
            foreach ($managerIds as $managerId) {
                // Don't self-notify
                if ($managerId === $deliverable->assigned_to) continue;
                Notification::create([
                    'user_id' => $managerId,
                    'title' => "Deliverable {$label}: {$title}",
                    'body' => "A deliverable is ready for your review.",
                    'type' => 'deliverable_status',
                    'deliverable_id' => $deliverableId,
                    'link' => "/deliverables",
                ]);
            }
        }

        // Notify assigned team member when approved or delivered
        if (in_array($newStatus, ['approved', 'delivered']) && $deliverable->assigned_to) {
            $label = ucfirst($newStatus);
            Notification::create([
                'user_id' => $deliverable->assigned_to,
                'title' => "Deliverable {$label}: {$title}",
                'body' => $newStatus === 'approved'
                    ? "Your deliverable has been approved! 🎉"
                    : "Your deliverable has been marked as delivered.",
                'type' => 'deliverable_status',
                'deliverable_id' => $deliverableId,
                'link' => "/deliverables",
            ]);
        }

        // Notify assigned member when manager pushes back to in_progress
        if ($newStatus === 'in_progress' && $deliverable->assigned_to) {
            Notification::create([
                'user_id' => $deliverable->assigned_to,
                'title' => "Deliverable updated: {$title}",
                'body' => "Your deliverable status has been updated to In Progress.",
                'type' => 'deliverable_status',
                'deliverable_id' => $deliverableId,
                'link' => "/deliverables",
            ]);
        }
    }
}
