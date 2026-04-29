<?php

namespace App\Policies;

use App\Models\MonthlyPlan;
use App\Models\User;

class MonthlyPlanPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->isInternal() || $user->hasRole('client');
    }

    public function view(User $user, MonthlyPlan $plan): bool
    {
        return $user->isInternal() || $plan->client?->user_id === $user->id;
    }

    public function create(User $user): bool
    {
        return $user->hasAnyRole(['admin', 'manager']);
    }

    public function update(User $user, MonthlyPlan $plan): bool
    {
        return $user->hasAnyRole(['admin', 'manager']);
    }

    public function delete(User $user, MonthlyPlan $plan): bool
    {
        return $user->hasRole('admin');
    }
}
